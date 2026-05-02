# Traffic Analysis Script — Detailed Explanation

`decrypt-network-capture.mjs` is an **offline P2P traffic analyser**. Given a Wireshark capture of
the app's outgoing UDP traffic, it decrypts the full protocol stack layer by
layer and prints every P2P operation that was sent (e.g. `@p2p/share-transaction`
with its plaintext payload).

---

## Protocol Stack

```
UDP datagram
  └── UDX packet               (reliable, ordered stream-over-UDP)
        └── secret-stream frame (length-prefixed; XChaCha20-Poly1305)
              └── protomux message
                    └── hypercore wire DATA message
                          └── autobase block (encrypted)
                                └── OplogMessage
                                      └── hyperdispatch operation
```

Each layer is described in detail below.

---

## Step 0 — Keys Required

Before the script can run, four keys must be obtained from running the app:

| Key | Source | Purpose |
|---|---|---|
| `txKey` | `@hyperswarm/secret-stream` log (32 bytes) | Decrypts the secretstream transport layer |
| `autobaseKey` | `[Space] autobaseKey:` console log | Identifies the Autobase core |
| `encryptionKey` | `[Space] encryptionKey:` console log | Decrypts Autobase blocks |
| `writerKey` | `[Space] writerKey:` console log (optional) | Identifies the writer core |

`txKey` is the **Noise XX split output**. Here is how it is derived, traced
through the [Noise Protocol Framework spec](https://noiseprotocol.org/noise.html):

### Noise XX handshake (§7.5)

`hyperswarm-secret-stream` uses the `XX` interactive handshake pattern. Both
parties have static Ed25519 key pairs; neither knows the other's key upfront:

```
→ e                     initiator sends ephemeral public key (cleartext)
← e, ee, s, es          responder sends ephemeral + encrypted static + DH(e,e) + DH(e,s)
→ s, se                 initiator sends encrypted static + DH(s,e)
```

Each `ee`, `es`, `se` token triggers a DH operation whose output is fed into the
`SymmetricState` via `MixKey(DH(...))` (§5.2), which calls:

```
ck, temp_k = HKDF(ck, dh_output, 2)
```

This ratchets the chaining key `ck` forward after each DH, continuously mixing
the three DH results into a single evolving secret.

### Split() — two directional keys (§5.2)

After the final handshake message is processed, `Split()` is called:

```
temp_k1, temp_k2 = HKDF(ck, zerolen, 2)
c1.InitializeKey(temp_k1)   → used by initiator to encrypt (tx)
c2.InitializeKey(temp_k2)   → used by responder to encrypt (their tx = our rx)
```

The spec states:
> *"Processing the final handshake message returns two `CipherState` objects,
> the first for encrypting transport messages from initiator to responder, and
> the second for messages in the other direction."*

This is why there are **two keys, not one**, even though DH normally produces a
single shared secret: the two keys are derived from the same final chaining key
but are assigned asymmetrically by role. What the initiator uses to **encrypt**
(`tx = temp_k1`) is exactly what the responder uses to **decrypt** (`rx = temp_k1`),
and vice versa. This prevents cross-direction replay attacks — a ciphertext
captured from Alice→Bob cannot be replayed back to Alice, because her `Pull`
cipher is keyed with `temp_k2`, not `temp_k1`.

In `noise-handshake/noise.js`:
```js
const [k1, k2] = this.split()       // HKDF(ck, zerolen, 2)
this.tx = this.initiator ? k1 : k2  // encrypt outgoing with this key
this.rx = this.initiator ? k2 : k1  // decrypt incoming with this key
```

In `@hyperswarm/secret-stream/index.js`:
```js
this._encrypt = new Push(tx.subarray(0, KEYBYTES), ...)  // outgoing cipher
this._decrypt = new Pull(rx.subarray(0, KEYBYTES))        // incoming cipher
```

`tx` is used to encrypt everything the initiator sends. By capturing only the
initiator's outgoing UDP packets (`ip.src == <device_ip>` in tshark) and
supplying `tx` as the key, the script can reverse the encryption.

`txKey` cannot be derived from the pcap alone — it requires the Ed25519 private
key to compute the three DH terms. It must be logged from inside the running app.

---

## Step 1 — Capture UDP Payloads with tshark

```powershell
& "C:\Program Files\Wireshark\tshark.exe" `
    -r "C:\Users\Julian\Downloads\test.pcap" `
    -Y "udp && ip.src == 10.215.173.1" `
    -T fields -e udp.payload `
    2>$null | Where-Object { $_ } | Set-Content udp_payloads.txt
```

| Flag | Meaning |
|---|---|
| `-r` | Read from pcap file |
| `-Y "udp && ip.src == ..."` | Keep only outgoing UDP from the device |
| `-T fields -e udp.payload` | Print only the raw UDP payload as a hex string |
| `Where-Object { $_ }` | Drop empty lines from packets without a payload field |

The result is a text file with one hex string per line, each representing one
UDP packet's payload (everything after the IP+UDP headers).

---

## Step 2 — Strip the UDX Header (`extractUdxData`)

UDX is a reliable, ordered, congestion-controlled stream protocol over UDP
(similar to TCP but designed only for P2P). Each UDP payload is a UDX packet.

**UDX fixed header (20 bytes):**

```
Byte 0     : magic byte   = 0xFF
Byte 1     : version      = 0x01
Byte 2     : type flags   (bitmask: 0x01=DATA, 0x02=END, 0x04=SACK, 0x08=MSG, 0x10=DESTROY)
Byte 3     : data_offset  (extra header bytes beyond 20, e.g. for SACK ranges)
Bytes 4-7  : stream id    (little-endian uint32)
Bytes 8-11 : window       (little-endian uint32)
Bytes 12-15: seq          (little-endian uint32)
Bytes 16-19: ack          (little-endian uint32)
Bytes 20+  : stream payload bytes
```

The script checks:
1. `buf[0] === 0xFF && buf[1] === 0x01` — valid UDX magic/version
2. `buf[2] & 0x01` — DATA flag is set (only DATA packets carry stream bytes)
3. `buf.length > 20` — there are actual payload bytes

Then it slices off the 20-byte header and returns the remaining bytes.

---

## Step 3 — Reassemble the Byte Stream

UDX is a **byte stream**, not a packet protocol. A single application-level
frame may be split across multiple UDP packets (if it exceeds MTU ~1400 bytes),
or a single UDP packet may contain bytes from two different frames.

The script concatenates all extracted payloads into one `stream` buffer before
doing any further parsing.

---

## Step 4 — Parse Secret-Stream Frames

`hyperswarm-secret-stream` imposes a **length-prefix framing** on top of the
UDX byte stream. This is not documented — it was discovered by reading
`_write()` and `_onrawdata()` in `@hyperswarm/secret-stream/index.js` directly.

Because libsodium's `crypto_secretstream_xchacha20poly1305_pull()` must receive
each ciphertext chunk in full (it verifies the authentication tag before
returning any plaintext), the library needs a way to know where one chunk ends
and the next begins. Since UDX is a byte stream with no inherent boundaries,
`hyperswarm-secret-stream` adds a 3-byte little-endian length prefix before
each ciphertext:

```
[3-byte little-endian length][ciphertext of that length]
[3-byte little-endian length][ciphertext of that length]
...
```

The maximum frame length is capped at `MAX_ATOMIC_WRITE = 256³ - 1 = 16,777,215`
bytes — the largest value expressible in 3 bytes.

The script reads the 3-byte length, validates that the full frame is present in
the concatenated stream, then slices each ciphertext blob into `frames[]`.

**Special frame — the setup frame (56 bytes):**

```
[32 bytes: stream ID = BLAKE2b(NS_INITIATOR or NS_RESPONDER, handshakeHash)]
[24 bytes: libsodium HEADERBYTES — the XChaCha20 initialisation vector]
```

This frame is sent in the clear immediately after the Noise handshake completes
(`_setupSecretStream` → `this._rawStream.write(buf)`). It carries no encrypted
data — its sole purpose is to bootstrap the libsodium cipher state on the
receiver:

- The 32-byte stream ID is `BLAKE2b(NS_INITIATOR or NS_RESPONDER, handshakeHash)`,
  which is unique per Noise session. The receiver checks it against an expected
  value to guard against routing frames from the wrong connection.
- The 24-byte header is the output of `crypto_secretstream_xchacha20poly1305_init_push()`,
  which generates a random 192-bit nonce internally and stores it in this buffer.
  The receiver passes it to `crypto_secretstream_xchacha20poly1305_init_pull()` to
  synchronise cipher state before decrypting any subsequent frames.

---

## Step 5 — Decrypt with sodium-secretstream (`decryptSession`)

`sodium-secretstream` is a thin Node.js wrapper around libsodium's
`crypto_secretstream_xchacha20poly1305` API ([docs](https://libsodium.gitbook.io/doc/secret-key_cryptography/secretstream)).

Libsodium secretstream is a **stateful authenticated streaming cipher** with
the following properties (taken directly from the libsodium docs):

- Messages cannot be truncated, removed, reordered, duplicated or modified
  without this being detected
- The same sequence encrypted twice will produce different ciphertexts
- An authentication tag is added to each encrypted message; stream corruption
  is detected early without reading to the end
- There are no practical limits to the total length of the stream
- The nonce advances automatically after every chunk — no manual nonce management

**How it maps to the wire format:**

| libsodium C API | hyperswarm-secret-stream | Wire bytes |
|---|---|---|
| `init_push(state, header, key)` | `new Push(txKey, undefined, buf.subarray(3+32))` | writes the 24-byte header into the setup frame |
| sender transmits `header` | `this._rawStream.write(buf)` (the 56-byte setup frame) | setup frame on wire |
| `init_pull(state, header, key)` | `this._decrypt.init(header)` in `_incoming()` | called when setup frame received |
| `push(state, ciphertext, msg)` | `this._encrypt.next(plain, cipher)` in `_write()` | `[3B len][ciphertext]` |
| `pull(state, msg, ciphertext)` | `this._decrypt.next(cipher)` in `_incoming()` | one frame per call |

Each `push()` output is exactly `plaintext_length + ABYTES` bytes, where
`ABYTES = 17` (16-byte Poly1305 tag + 1-byte tag field). This is why the
ciphertext in each frame is always 17 bytes longer than the plaintext.

After every `pull()` call the internal nonce evolves as:
```
n ← n XOR mac[0..8]
i ← i + 1
```
This means the receiver must process frames **in order** — skipping or
replaying any frame desynchronises the nonce and breaks all subsequent
decryptions. That is the fundamental reason the script must concatenate all
UDP payloads in sequence before parsing.

The script finds all 56-byte setup frames in the stream, tries each one with
`txKey`, and uses the first session where the first frame decrypts successfully.

---

## Step 6 — Parse Protomux Messages (`parseProtomuxFrame`)

Each decrypted plaintext is a **protomux message**. Protomux is a channel
multiplexer — it allows many logical channels (one per hypercore) to share the
same physical connection.

**Wire format** (all integers are compact-encoded varints):

```
[remoteId: varint][type: varint][payload...]
```

- `remoteId === 0` → **control channel** message, `type` indicates:
  - `0` = batch (multiple messages packed together)
  - `1` = open (opens a new channel)
  - `2` = reject
  - `3` = close
- `remoteId > 0` → **data channel** message for an already-opened channel

**Batch messages** pack several messages to avoid per-message framing overhead.
Their payload is:

```
[firstChannelId: varint]
  [msgLen: varint][msgData...]    ← msgLen=0 means "switch to next channel"
  [0][nextChannelId: varint]
  [msgLen: varint][msgData...]
  ...
```

**Open messages** register a new channel:

```
[remoteId: varint][protocol: string][discoveryKey: buffer]
```

`discoveryKey` is `BLAKE2b("hypercore", publicKey)`. The script keeps a
`discoveryToPublicKey` map to reverse this for known cores (autobaseKey,
writerKey).

---

## Step 7 — Decode Hypercore Wire DATA Messages (`dispatchChannelMsg`)

The script only processes messages on `hypercore/alpha` protocol channels with
message type `3` (DATA). All other channel types (sync, request, cancel, want,
bitfield, etc.) are ignored.

A hypercore DATA message is decoded using `hypercore/lib/messages.js`:

```js
hcMessages.wire.data.decode(state)
// → { block: { index: number, value: Buffer, nodes: [...] } }
```

`block.index` is the block's sequence number in the hypercore log.  
`block.value` is the raw encrypted block bytes.

---

## Step 8 — Decrypt Autobase Blocks (`decryptBlock`)

Every Autobase block has an 8-byte **padding prefix** followed by the
actual `body`:

```
[8 bytes: padding][body...]
```

`padding[0]` determines the encryption mode:

### Mode 0 — Unencrypted
`padding[0] === 0` means an optimistic (unencrypted) entry.  
→ Decode `body` directly.

### Mode 1 — Non-compat WriterEncryption (newer Autobase)

```
blockKey = BLAKE2b([NS_VIEW_BLOCK_KEY, autobaseKey, encryptionKey, GENESIS_ENTROPY, publicKey])
nonce    = [uint64LE(blockIndex)][padding[0..7]]
body     = XOR(body, ChaCha20-stream(nonce, blockKey))
```

Where:
- `NS_VIEW_BLOCK_KEY` = `autobase/lib/caps.js → NS_VIEW_BLOCK_KEY`
- `GENESIS_ENTROPY` = `hcCrypto.namespace('autobase/entropy', 2)[0]`
- `publicKey` = the hypercore's Ed25519 public key

### Mode other — Compat HypercoreDefaultEncryption (older Autobase, `manifest.version ≤ 1`)

```
blockKey = BLAKE2b([DEFAULT_ENCRYPTION, publicKey, encryptionKey])
```

Using `DefaultEncryption.blockEncryptionKey(publicKey, encryptionKey)` and
`DefaultEncryption.decrypt(blockIndex, block, blockKey)` from
`hypercore/lib/default-encryption.js`. This operates in-place on the full
block (padding + body together).

---

## Step 9 — Decode OplogMessage + Hyperdispatch

The decrypted `body` is an **OplogMessage** (Autobase's internal operation log
format, defined in `autobase/lib/messages.js`):

```
OplogMessage { node: { value: Buffer, ... }, ... }
```

`node.value` contains the serialised hyperdispatch operation. The script calls:

```js
hdDecode(nodeValue)
// → { id: number, name: string, value: object }
```

`name` is the operation type (e.g. `@p2p/share-transaction`, `@p2p/add-category`)
and `value` is the decoded payload object.

---

## Key Derivation Summary

```
Noise XX handshake (3 messages over UDX)
  ↓ Split() → HKDF(final_ck, zerolen, 2)
  txKey (32 bytes)                           ← must be logged from app
    ↓ sodium-secretstream Pull(txKey)
    Decrypted protomux messages
      ↓ channel open → discoveryKey
      BLAKE2b("hypercore", publicKey) lookup  ← autobaseKey / writerKey must be known
        ↓ Autobase block encryption
        BLAKE2b([NS_VIEW_BLOCK_KEY, autobaseKey, encryptionKey, ...])
          ↓ XOR(body, ChaCha20-stream)
          OplogMessage → hyperdispatch name + value
```

---

## Running the Script

1. Start the app and copy the following from its console logs:
   - `[Space] autobaseKey: <hex>`
   - `[Space] encryptionKey: <hex>`
   - `[Space] writerKey: <hex>` (optional)
   - `txKey` from `@hyperswarm/secret-stream` debug log

2. Paste the keys into the config section at the top of `test.mjs`.

3. Capture traffic with tshark (adjust IP and pcap path):
   ```powershell
   & "C:\Program Files\Wireshark\tshark.exe" `
       -r "C:\Users\Julian\Downloads\test.pcap" `
       -Y "udp && ip.src == 10.215.173.1" `
       -T fields -e udp.payload `
       2>$null | Where-Object { $_ } | Set-Content udp_payloads.txt
   ```

4. Run:
   ```powershell
   node test.mjs udp_payloads.txt
   ```

---

## References

| Library | Role |
|---|---|
| [`holepunchto/libudx`](https://github.com/holepunchto/libudx) | UDX C implementation; `docs/wireshark/udx.lua` documents the header format |
| [`holepunchto/udx-native`](https://github.com/holepunchto/udx-native) | Node.js bindings for libudx |
| [`hyperswarm/secret-stream`](https://github.com/holepunchto/hyperswarm-secret-stream) | Noise XX handshake + secretstream transport |
| [`noiseprotocol.org`](https://noiseprotocol.org/noise.html) | Noise protocol specification (XX pattern, Split function) |
| [`hypercore-crypto`](https://github.com/holepunchto/hypercore-crypto) | BLAKE2b hashing, namespace derivation, discoveryKey |
| [`hypercore`](https://github.com/holepunchto/hypercore) | `lib/messages.js` wire format; `lib/default-encryption.js` compat decryption |
| [`autobase`](https://github.com/holepunchto/autobase) | `lib/messages.js` OplogMessage; `lib/caps.js` namespace constants |
| [`protomux`](https://github.com/holepunchto/protomux) | Channel multiplexer wire format |
| [`compact-encoding`](https://github.com/compact-encoding/compact-encoding) | Varint / string / buffer codec |
| [`sodium-secretstream`](https://github.com/emilbayes/sodium-secretstream) | XChaCha20-Poly1305 streaming AEAD |
| [libsodium secretstream docs](https://libsodium.gitbook.io/doc/secret-key_cryptography/secretstream) | Documents `HEADERBYTES`, `init_push`/`init_pull`, `push`/`pull`, tags, and the XChaCha20-Poly1305 algorithm |
