// curl -NLs http://<ROUTER_IP>:8080 | "C:/Program Files/Wireshark/Wireshark.exe" -k -i -
import { Pull } from 'sodium-secretstream'
import { readFileSync } from 'fs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const c                  = require('compact-encoding')
const sodium             = require('sodium-universal')
const hcCrypto           = require('hypercore-crypto')
const hcMessages         = require('hypercore/lib/messages.js')
const DefaultEncryption  = require('hypercore/lib/default-encryption.js')
const { DEFAULT_ENCRYPTION } = require('hypercore/lib/caps.js')
const { NS_VIEW_BLOCK_KEY }  = require('autobase/lib/caps.js')
const { OplogMessage } = require('autobase/lib/messages.js')
const { decode: hdDecode } = require('../application/generated/spec/hyperdispatch/index.js')

// ── Paste TX key from your console logs ─────────────────────────────────────
// TX = the local device's outgoing stream. Use ip.src == <your_device_IP> in tshark.
// The TX key is logged by the backend on space open: "TX key: <hex>"
const txKey = Buffer.from('<YOUR_TX_KEY_HEX>', 'hex')

// ── Block decryption keys (from space.mjs console logs) ───────────────────────
// After space.ready(), [Space] autobaseKey/encryptionKey/writerKey are logged.
// Set these to enable full autobase block decryption → hyperdispatch decoding.
const autobaseKey   = Buffer.from('<YOUR_AUTOBASE_KEY_HEX>', 'hex')
const encryptionKey = Buffer.from('<YOUR_ENCRYPTION_KEY_HEX>', 'hex')
const writerKey     = null  // e.g. Buffer.from('<YOUR_WRITER_KEY_HEX>', 'hex')  ← from [Space] writerKey: log

// The protomux open id is the discovery key; build a map to recover the public key
// discoveryKey = BLAKE2b("hypercore", publicKey)
const discoveryToPublicKey = new Map()
for (const pubKey of [autobaseKey, writerKey].filter(Boolean)) {
  discoveryToPublicKey.set(hcCrypto.discoveryKey(pubKey).toString('hex'), pubKey)
}

// Pre-compute deterministic protocol constant (used for non-compat block key derivation)
const GENESIS_ENTROPY = hcCrypto.namespace('autobase/entropy', 2)[0]

// Hypercore wire message type indices (matches messages[] order in replicator.js)
// 0=sync 1=request 2=cancel 3=data 4=noData 5=want 6=unwant 7=bitfield 8=range 9=extension
const HC_DATA_TYPE = 3

// ── Load raw UDP payloads ─────────────────────────────────────────────────────
// Use udp.payload (no Lua plugin needed), the script strips the UDX header.
//
// tshark command (adjust capture file path and YOUR device's IP):
//   & "C:\Program Files\Wireshark\tshark.exe" `
//       -r "<PATH_TO_YOUR_CAPTURE_FILE>.pcap" `
//       -Y "udp && ip.src == <YOUR_DEVICE_IP>" `
//       -T fields -e udp.payload `
//       2>$null | Where-Object { $_ } | Set-Content udp_payloads.txt
//
// Then run:  node test.mjs udp_payloads.txt

let rawPackets
const inputFile = process.argv[2]
if (inputFile) {
  rawPackets = readFileSync(inputFile, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
  console.log(`Loaded ${rawPackets.length} UDP packet(s) from ${inputFile}`)
} else {
  rawPackets = []
}

// ── Strip UDX header from each UDP packet ────────────────────────────────────
// UDX wire format: [20-byte fixed header][optional SACK ext][stream data]
// Byte 3 of the header is data_offset (in 4-byte units), same convention as IPv4 IHL.
// Minimum: data_offset=5 → 20 bytes of header, no extension.
// Only DATA packets (type & 0x01) carry stream bytes; skip everything else.
function extractUdxData(hex) {
  const buf = Buffer.from(hex, 'hex')
  if (buf.length < 20) return null
  if (buf[0] !== 0xff || buf[1] !== 0x01) return null   // not UDX
  if (!(buf[2] & 0x01)) return null                      // not a DATA packet
  if (buf.length <= 20) return null                      // no payload bytes
  return buf.slice(20)                                   // skip the fixed 20-byte UDX header
}

// ── Concatenate stream and parse frames ───────────────────────────────────────
// UDX is a byte stream; frames can span packet boundaries.
// We must concatenate all payloads before parsing.
const chunks = rawPackets.map(extractUdxData).filter(Boolean)
console.log(`${chunks.length} DATA packet(s) out of ${rawPackets.length} total`)
const stream = Buffer.concat(chunks)
console.log(`Stream: ${stream.length} bytes from ${chunks.length} DATA packet(s)`)

const IDHEADERBYTES = 32 + 24  // 56 — exact size of the setup frame content

const frames = []
let pos = 0
while (pos + 3 <= stream.length) {
  const len = stream[pos] | (stream[pos + 1] << 8) | (stream[pos + 2] << 16)
  if (pos + 3 + len > stream.length) {
    console.log(`\nStream ends mid-frame: need ${(pos + 3 + len) - stream.length} more bytes (add the next packet)`)
    break
  }
  frames.push(stream.slice(pos + 3, pos + 3 + len))
  pos += 3 + len
}
console.log(`Parsed ${frames.length} complete frame(s)\n`)

// ── Decrypt ───────────────────────────────────────────────────────────────────
// Each 56-byte frame starts a new secretstream session. Try every setup frame in
// order and stop at the first one that decrypts successfully with txKey.
const setupFrames = []
for (let i = 0; i < frames.length; i++) {
  if (frames[i].length === IDHEADERBYTES) {
    console.log(`frame[${i}] — 56B → SETUP FRAME  header: ${frames[i].slice(32).toString('hex')}`)
    setupFrames.push(i)
  }
}

if (setupFrames.length === 0) {
  console.log('\nNo setup frames found in capture — add more packets.')
  process.exit(1)
}

console.log(`\nTrying ${setupFrames.length} setup frame(s) in order...\n`)
for (const start of setupFrames) {
  console.log(`--- Trying session starting at frame[${start}] ---`)
  if (decryptSession(start)) break
}

function decryptSession(start) {
  const pull = new Pull(txKey)
  pull.init(frames[start].slice(32))

  // Track protomux channel → { protocol, discoveryKey }
  const channels = new Map()

  let anyDecrypted = false
  for (let i = start + 1; i < frames.length; i++) {
    const frame = frames[i]
    // A new setup frame means a different session — stop here
    if (frame.length === IDHEADERBYTES) break

    try {
      const plain = pull.next(frame)
      console.log(`frame[${i}] — ${frame.length}B → decrypted ${plain.length}B`)
      anyDecrypted = true

      if (plain.length > 0) {
        parseProtomuxFrame(plain, channels)
      }
    } catch {
      console.log(`frame[${i}] — ${frame.length}B → ✗ decryption failed`)
      if (!anyDecrypted) {
        console.log('  (first frame failed — this session does not match txKey, skipping)')
        return false
      }
    }
  }
  return anyDecrypted
}

// ── Compact-encoding state helper ────────────────────────────────────────────────────
// Creates a mutable state object for use with c.uint / c.string / c.buffer decoders.
// state.start advances automatically after each decode call.
function mkState(buf, start = 0) {
  return { buffer: buf, start, end: buf.length }
}

// ── Protomux frame parser ───────────────────────────────────────────────────────
// channels: Map<channelId, { protocol, coreKey }>
function parseProtomuxFrame(data, channels) {
  try {
    const st = mkState(data)
    const remoteId = c.uint.decode(st)
    const type = c.uint.decode(st)

    if (remoteId === 0) {
      switch (type) {
        case 0: parseBatch(data, st.start, channels); break
        case 1: parseOpen(data, st.start, channels); break
        case 2: console.log(`  protomux: reject localId=${c.uint.decode(mkState(data, st.start))}`); break
        case 3: console.log(`  protomux: close  localId=${c.uint.decode(mkState(data, st.start))}`); break
        default: console.log(`  protomux: unknown control type ${type}`)
      }
    } else {
      dispatchChannelMsg(remoteId, type, data.slice(st.start), channels)
    }
  } catch (err) {
    console.log(`  protomux parse error: ${err.message}`)
  }
}

function parseBatch(data, batchStart, channels) {
  const st = mkState(data, batchStart)
  let curId = c.uint.decode(st)

  while (st.start < st.end) {
    const msgLen = c.uint.decode(st)
    if (msgLen === 0) {
      curId = c.uint.decode(st)
      continue
    }
    if (st.start + msgLen > st.end) break
    const msgData = data.slice(st.start, st.start + msgLen)
    st.start += msgLen
    const msgSt = mkState(msgData)
    const msgType = c.uint.decode(msgSt)
    if (curId === 0) {
      // sub-message on control channel — route the same as outer control frames
      switch (msgType) {
        case 1: parseOpen(msgData, msgSt.start, channels); break
        case 2: console.log(`  protomux: batch reject localId=${c.uint.decode(msgSt)}`); break
        case 3: console.log(`  protomux: batch close  localId=${c.uint.decode(msgSt)}`); break
        default: break   // type 0 = nested batch — rare, ignore for now
      }
    } else {
      dispatchChannelMsg(curId, msgType, msgData.slice(msgSt.start), channels)
    }
  }
}

function parseOpen(data, pos, channels) {
  const st = mkState(data, pos)
  const rId = c.uint.decode(st)
  const proto = c.string.decode(st)
  const coreKey = c.buffer.decode(st)
  channels.set(rId, { protocol: proto, discoveryKey: coreKey })
  const publicKey = discoveryToPublicKey.get(coreKey.toString('hex'))
  const keyLabel = publicKey ? `pubkey=${publicKey.toString('hex').slice(0,12)}…` : `dkey=${coreKey.toString('hex').slice(0,12)}… (unknown — log writerKey)`
  console.log(`  protomux: open ch=${rId} proto="${proto}" ${keyLabel}`)
}

// ── Hypercore wire.data decoder ────────────────────────────────────────────────
function dispatchChannelMsg(chId, msgType, payload, channels) {
  const ch = channels.get(chId)
  const protoLabel = ch ? `"${ch.protocol}"` : 'unknown'
  console.log(`  protomux: ch=${chId} ${protoLabel} msgType=${msgType} payloadLen=${payload.length}`)

  if (!ch || ch.protocol !== 'hypercore/alpha') return
  if (msgType !== HC_DATA_TYPE) return

  try {
    const state = { buffer: payload, start: 0, end: payload.length }
    const dataMsg = hcMessages.wire.data.decode(state)

    if (!dataMsg.block) return

    const { index, value: blockValue } = dataMsg.block
    console.log(`    hypercore DATA block index=${index} value=${blockValue.length}B`)

    if (!autobaseKey || !encryptionKey) {
      console.log('    (set autobaseKey + encryptionKey to decrypt block)')
      console.log('    block hex:', blockValue.toString('hex'))
      return
    }

    const publicKey = discoveryToPublicKey.get(ch.discoveryKey.toString('hex'))
    if (!publicKey) {
      console.log(`    (unknown core — add its public key to discoveryToPublicKey; discoveryKey=${ch.discoveryKey.toString('hex').slice(0,16)}…)`)
      console.log('    block hex:', blockValue.toString('hex'))
      return
    }
    decryptBlock(blockValue, index, publicKey)
  } catch (err) {
    console.log(`    hypercore DATA decode error: ${err.message}`)
  }
}

// ── Autobase block decryptor ────────────────────────────────────────────────────
// Two encryption modes:
//   non-compat (padding[0]=1): WriterEncryption — blockKey = hash([NS_VIEW_BLOCK_KEY, bootstrapKey, encKey, GENESIS_ENTROPY, pubKey])
//   compat (padding[0] is blinded fork ID): HypercoreDefaultEncryption — blockKey = hash([DEFAULT_ENCRYPTION, pubKey, encKey])
// In both modes: nonce = [uint64LE(index)][padding[0..7]]
function decryptBlock(blockValue, blockIndex, publicKey) {
  try {
    const block = Buffer.from(blockValue)           // mutable copy
    const padding = block.subarray(0, 8)
    const body    = block.subarray(8)

    if (padding[0] === 0) {
      // Unencrypted optimistic entry
      decodeOplogAndDispatch(body)
      return
    }

    if (padding[0] === 1) {
      // Non-compat AutobaseEncryption (WriterEncryption)
      const id = block.readUInt32LE(4)
      if (id !== 0) {
        console.log(`    encryption id=${id} > 0 — need encryption view core (not supported offline)`)
        return
      }
      const blockKey = hcCrypto.hash([NS_VIEW_BLOCK_KEY, autobaseKey, encryptionKey, GENESIS_ENTROPY, publicKey])
      const nonce = Buffer.alloc(24, 0)
      c.uint64.encode({ start: 0, end: 8, buffer: nonce }, blockIndex)
      padding.copy(nonce, 8)
      sodium.crypto_stream_xor(body, body, nonce, blockKey)
      decodeOplogAndDispatch(body)
    } else {
      // Compat mode: HypercoreDefaultEncryption (manifest.version <= 1)
      // DefaultEncryption.decrypt operates in-place on the full block (including padding)
      const blockKey = DefaultEncryption.blockEncryptionKey(publicKey, encryptionKey)
      DefaultEncryption.decrypt(blockIndex, block, blockKey)
      decodeOplogAndDispatch(body)
    }
  } catch (err) {
    console.log(`    block decrypt error: ${err.message}`)
  }
}

// ── OplogMessage decoder + hyperdispatch ───────────────────────────────────────
function decodeOplogAndDispatch(body) {
  try {
    const state = { buffer: body, start: 0, end: body.length }
    const op = OplogMessage.decode(state)
    const nodeValue = op.node && op.node.value
    if (!nodeValue || nodeValue.length === 0) return

    const dispatchOp = hdDecode(nodeValue)
    console.log(`    ✓ hyperdispatch op: ${dispatchOp.name}`)
    console.log('    ', JSON.stringify(dispatchOp.value, bufferReplacer, 2).replace(/\n/g, '\n    '))
  } catch (err) {
    console.log(`    decode error: ${err.message}`)
  }
}

function bufferReplacer(key, val) {
  if (val && val.type === 'Buffer' && Array.isArray(val.data)) {
    return Buffer.from(val.data).toString('hex')
  }
  return val
}