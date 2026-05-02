/**
 * Crypto utilities for password KDF and blind key management (Bare runtime).
 *
 * All cryptographic operations use sodium-universal (via sodium-native).
 * Memory safety: sensitive buffers are allocated with sodium_malloc and zeroed
 * in finally blocks via sodium_memzero following the PearPass pattern.
 */

import sodium from 'sodium-universal'

// Argon2id parameters — OPSLIMIT_SENSITIVE / MEMLIMIT_INTERACTIVE
// Intentionally slow (~3-5 s on mobile) for brute-force resistance.
const OPSLIMIT = sodium.crypto_pwhash_OPSLIMIT_SENSITIVE
const MEMLIMIT = sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE
const ALG = sodium.crypto_pwhash_ALG_ARGON2ID13
const SALT_BYTES = sodium.crypto_pwhash_SALTBYTES  // 16 bytes
const KEY_BYTES = 32  // 32-byte key

/**
 * Derive a 32-byte key from a password using Argon2id.
 * @param {string} password - User's plaintext password
 * @param {string|null} [saltBase64] - Base64-encoded 16-byte salt. Generated if not provided.
 * @returns {{ hashedPassword: string, salt: string }} hex-encoded key and base64-encoded salt
 */
export function hashPassword(password, saltBase64 = null) {
  const passwordLen = Buffer.byteLength(password, 'utf8')
  const passwordBuf = sodium.sodium_malloc(passwordLen)
  const saltBuf = sodium.sodium_malloc(SALT_BYTES)
  const keyBuf = sodium.sodium_malloc(KEY_BYTES)

  try {

    Buffer.from(password, 'utf8').copy(passwordBuf)

    if (saltBase64) {
      Buffer.from(saltBase64, 'base64').copy(saltBuf)
    } else {
      sodium.randombytes_buf(saltBuf)
    }

    sodium.crypto_pwhash(
      keyBuf,
      passwordBuf,
      saltBuf,
      OPSLIMIT,
      MEMLIMIT,
      ALG
    )

    const hashedPassword = keyBuf.toString('hex')
    const salt = saltBuf.toString('base64')

    return { hashedPassword, salt }
  } finally {
    sodium.sodium_memzero(keyBuf)
    sodium.sodium_memzero(passwordBuf)
    sodium.sodium_memzero(saltBuf)
    sodium.sodium_free(keyBuf)
    sodium.sodium_free(passwordBuf)
    sodium.sodium_free(saltBuf)
  }
}

/**
 * Encrypt a blind encryption key with `crypto_secretbox_easy`.
 * @param {string} blindKeyBase64 - Base64-encoded 32-byte blind encryption key
 * @param {string} hashedPasswordHex - 64-char hex string (32-byte key from Argon2id)
 * @returns {{ ciphertext: string, nonce: string }} base64-encoded ciphertext and nonce
 */
export function encryptBlindKey(blindKeyBase64, hashedPasswordHex) {
  const message = sodium.sodium_malloc(32)
  const keyBuf = sodium.sodium_malloc(KEY_BYTES)
  const nonceBuf = sodium.sodium_malloc(sodium.crypto_secretbox_NONCEBYTES)
  const ciphertextBuf = sodium.sodium_malloc(sodium.crypto_secretbox_MACBYTES + 32)

  try {
    Buffer.from(blindKeyBase64, 'base64').copy(message)
    Buffer.from(hashedPasswordHex, 'hex').copy(keyBuf)
    sodium.randombytes_buf(nonceBuf)

    sodium.crypto_secretbox_easy(ciphertextBuf, message, nonceBuf, keyBuf)

    return {
      ciphertext: ciphertextBuf.toString('base64'),
      nonce: nonceBuf.toString('base64'),
    }
  } finally {
    sodium.sodium_memzero(message)
    sodium.sodium_memzero(keyBuf)
    sodium.sodium_memzero(nonceBuf)
    sodium.sodium_memzero(ciphertextBuf)

    sodium.sodium_free(message)
    sodium.sodium_free(keyBuf)
    sodium.sodium_free(nonceBuf)
    sodium.sodium_free(ciphertextBuf)
  }
}

/**
 * Decrypt a blind encryption key with `crypto_secretbox_open_easy`.
 * @param {string} ciphertextBase64 - Base64-encoded ciphertext (MAC + ciphertext)
 * @param {string} nonceBase64 - Base64-encoded nonce
 * @param {string} hashedPasswordHex - 64-char hex string (32-byte key from Argon2id)
 * @returns {string|null} base64-encoded blind key, or null if decryption fails (wrong password)
 */
export function decryptBlindKey(ciphertextBase64, nonceBase64, hashedPasswordHex) {
  const ciphertext = Buffer.from(ciphertextBase64, 'base64')
  const keyBuf = sodium.sodium_malloc(KEY_BYTES)
  const nonceBuf = sodium.sodium_malloc(sodium.crypto_secretbox_NONCEBYTES)
  const plaintextBuf = sodium.sodium_malloc(ciphertext.length - sodium.crypto_secretbox_MACBYTES)
  const ciphertextBuf = sodium.sodium_malloc(ciphertext.length)

  try {
    Buffer.from(hashedPasswordHex, 'hex').copy(keyBuf)
    Buffer.from(nonceBase64, 'base64').copy(nonceBuf)
    ciphertext.copy(ciphertextBuf)

    const ok = sodium.crypto_secretbox_open_easy(plaintextBuf, ciphertextBuf, nonceBuf, keyBuf)
    if (!ok) return null

    return plaintextBuf.toString('base64')
  } finally {
    sodium.sodium_memzero(keyBuf)
    sodium.sodium_memzero(nonceBuf)
    sodium.sodium_memzero(plaintextBuf)
    sodium.sodium_memzero(ciphertextBuf)
    sodium.sodium_free(keyBuf)
    sodium.sodium_free(nonceBuf)
    sodium.sodium_free(plaintextBuf)
    sodium.sodium_free(ciphertextBuf)
  }
}

/**
 * Generate a random 32-byte blind encryption key.
 * @returns {string} base64-encoded 32-byte key
 */
export function generateBlindEncryptionKey() {
  const buf = sodium.sodium_malloc(32)
  try {
    sodium.randombytes_buf(buf)
    return buf.toString('base64')
  } finally {
    sodium.sodium_memzero(buf)
    sodium.sodium_free(buf)
  }
}
