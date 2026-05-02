/**
 * decrypt-autobase.mjs
 *
 * Demonstrates Autobase at-rest encryption by:
 *   1. Re-deriving the blind encryption key from password + bootstrapRecord
 *      (identical KDF chain to the app: Argon2id → secretbox_open)
 *   2. Auto-discovering Autobase bootstrap keys from the corestore
 *   3. Opening each candidate with Autobase + BlindEncryptionSodium
 *   4. Calling base.update() to process all writer blocks through apply()
 *   5. Printing every decrypted + decoded Hyperdispatch operation
 *
 * Prerequisites:
 *   - npm install
 *
 * Usage:
 *   node decrypt-autobase.mjs
 */

import Corestore from 'corestore'
import Autobase from 'autobase'
import BlindEncryptionSodium from 'blind-encryption-sodium'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// ── Config ────────────────────────────────────────────────────────────────────

const CORESTORE_PATH = process.argv[2] || (() => {
  console.error('Usage: node decrypt-autobase.mjs <path-to-corestore>')
  console.error('  Example: node decrypt-autobase.mjs ./extract/content/apps/<package>/f/prototype')
  process.exit(1)
})()

// Intercepted from adb logcat [AUTH-DEMO] — replace with the key from your own test session
const BLIND_ENCRYPTION_KEY = '<YOUR_BLIND_ENCRYPTION_KEY_BASE64>'

const SPACE_ID = '<YOUR_SPACE_ID_UUID>'

// Hyperdispatch decoder (CJS) and Autobase OplogMessage encoding (CJS)
const hyperdispatch = require('../application/generated/spec/hyperdispatch/index.js')

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('=== AUTOBASE DECRYPTION DEMO ===')
console.log()

if (!require('fs').existsSync(CORESTORE_PATH)) {
  console.error('Backup not found at:', CORESTORE_PATH)
  process.exit(1)
}

// --- Step 1: Use intercepted blind encryption key ---

console.log('blindEncryptionKey (base64):', BLIND_ENCRYPTION_KEY)
console.log()

// --- Step 2: Open corestore ---
console.log('Opening corestore at:', CORESTORE_PATH)
const store = new Corestore(CORESTORE_PATH, { readOnly: true })
await store.ready()
console.log('✓ Corestore opened')
console.log()

console.log(`Space ID: ${SPACE_ID}`)
console.log()

// --- Step 3: Reopen Autobase via namespace (mirrors app reopen flow, no bootstrap key needed) ---

const namespacedStore = store.namespace(SPACE_ID)

let base
try {
  base = new Autobase(namespacedStore, null, {
    open: (s) => s.get('view'),
    apply: async () => { },
    encrypt: true,
    encrypted: true,
    blindEncryption: new BlindEncryptionSodium(
      Buffer.from(BLIND_ENCRYPTION_KEY, 'base64')
    )
  })

  await base.ready()
} catch (err) {
  console.log('  ❌ Failed to open Autobase:', err.message)
  if (base) await base.close().catch(() => { })
  await store.close()
  process.exit(1)
}

const encKey = base.encryptionKey
if (!encKey) {
  console.log('  ⚠ No encryption key found — not an encrypted Space bootstrap core')
  await base.close()
  await store.close()
  process.exit(1)
}

console.log(`  ✓ Autobase ready`)
console.log(`  encryptionKey (hex): ${encKey.toString('hex')}`)

// -- Read operations from the view hypercore --
// apply() appends raw Hyperdispatch buffers to the view, encrypted with encryptionKey.
// base.view is already the decrypted session; blocks are ready to decode directly.
const view = base.view
console.log(`  View length: ${view.length} blocks`)

let opCount = 0
for (let i = 0; i < view.length; i++) {
  const value = await view.get(i)
  if (!value?.length) continue

  opCount++
  try {
    const decoded = hyperdispatch.decode(value)
    console.log(`  [${i}] ${decoded.name}`)
    console.log('      ', JSON.stringify(decoded.value, null, 6).replace(/\n/g, '\n       '))
  } catch (e) {
    console.log(`  [${i}] (decode error: ${e.message}) raw: ${value.toString('hex').slice(0, 40)}...`)
  }
}

if (opCount === 0) console.log('  (no operations with values)')
console.log()

await base.close()

await store.close()

