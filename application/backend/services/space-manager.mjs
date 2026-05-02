/**
 * SpaceManager Class (Bare Runtime)
 * 
 * Orchestrates lifecycle of multiple Space instances.
 * Manages shared Corestore + Hyperswarm + BlindPairing instances.
 */

import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'
import BlindPairing from 'blind-pairing'
import Autobase from 'autobase'
import b4a from 'b4a'
import z32 from 'z32'
import { Space } from './space.mjs'

class SpaceManager {

  _blindEncryptionKey = null  // Set after authentication
  constructor(basePath, router) {
    this.basePath = basePath
    this.router = router  // Hyperdispatch router
    this.store = null
    this.swarm = null
    this.blindPairing = null
    this.spaces = new Map()  // spaceId -> Space instance
  }

  async ready() {
    this.store = new Corestore(this.basePath)
    await this.store.ready()
    this.swarm = new Hyperswarm()
    this.blindPairing = new BlindPairing(this.swarm, { poll: 5000 })
    console.log('[SpaceManager] Initialized with Corestore, Hyperswarm, and BlindPairing')
  }

  /**
   * Set the blind encryption key (called after successful authentication).
   * @param {string|null} key - Base64-encoded 32-byte blind key
   */
  set blindEncryptionKey(key) {
    this._blindEncryptionKey = key
  }

  async close() {
    console.log('[SpaceManager] Closing all spaces...')
    for (const space of this.spaces.values()) {
      await space.close()
    }
    this.spaces.clear()
    console.log('[SpaceManager] Closing blind pairing...')
    if (this.blindPairing) this.blindPairing.close()
    console.log('[SpaceManager] Closing swarm...')
    if (this.swarm) this.swarm.destroy()
    console.log('[SpaceManager] Closing store...')
    if (this.store) this.store.close()
    console.log('[SpaceManager] Closed')
  }

  /**
   * Create a new Space.
   * Autobase generates the encryptionKey internally and stores it via blind encryption.
   * @param {string} spaceId - Space ID
   */
  async createSpace(spaceId) {
    if (this.spaces.has(spaceId)) {
      throw new Error(`Space already exists: ${spaceId}`)
    }

    const namespacedStore = this.store.namespace(spaceId)
    const space = new Space(spaceId, namespacedStore, this.swarm, this.blindPairing, this.router, {
      blindEncryptionKey: this._blindEncryptionKey,
    })
    await space.ready()
    this.spaces.set(spaceId, space)
    console.log('[SpaceManager] Created space:', spaceId)
  }

  /**
   * Open existing Space (for Spaces we've already joined).
   * Autobase reads the encryptionKey from its own storage via blind encryption.
   * @param {string} spaceId - Space ID
   * @returns {Promise<Space>} Space instance
   */
  async openSpace(spaceId) {
    // Check if already open
    if (this.spaces.has(spaceId)) {
      console.log('[SpaceManager] Space already open:', spaceId)
      return this.spaces.get(spaceId)
    }
    const namespacedStore = this.store.namespace(spaceId)

    const space = new Space(spaceId, namespacedStore, this.swarm, this.blindPairing, this.router, {
      blindEncryptionKey: this._blindEncryptionKey,
    })
    await space.ready()
    this.spaces.set(spaceId, space)
    console.log('[SpaceManager] Opened space:', spaceId)
    return space
  }

  /**
   * Close a Space
   * @param {string} spaceId - Space ID
   */
  async closeSpace(spaceId) {
    const space = this.spaces.get(spaceId)
    if (!space) {
      console.warn('[SpaceManager] Space not found for closing:', spaceId)
      return
    }
    await space.close()
    this.spaces.delete(spaceId)
    console.log('[SpaceManager] Closed space:', spaceId)
  }

  /**
   * Get Space instance
   * @param {string} spaceId - Space ID
   * @returns {Space | undefined} Space instance
   */
  getSpace(spaceId) {
    return this.spaces.get(spaceId)
  }

  /**
   * Rotate the blind encryption key on all open Autobase instances.
   * Each space is re-opened with BlindEncryptionSodium(newKey, oldKey) to migrate userData.
   * Called from `changePassword` to provide forward secrecy.
   * @param {string} newBlindKeyBase64 - New blind key (base64)
   */
  async rotateBlindKey(newBlindKeyBase64) {
    const oldBlindKeyBase64 = this._blindEncryptionKey
    for (const [spaceId, space] of this.spaces.entries()) {
      const autobaseKey = space.autobase ? b4a.toString(space.autobase.key, 'base64') : null
      console.log('[SpaceManager] Rotating blind key for space:', spaceId)

      // Close the existing Space
      await space.close()

      // Reopen with both old and new blind keys — Autobase boot.js will
      // decrypt userData with oldKey and immediately re-store with newKey (rotated: true)
      const namespacedStore = this.store.namespace(spaceId)
      const reopened = new Space(spaceId, namespacedStore, this.swarm, this.blindPairing, this.router, {
        key: autobaseKey ? b4a.from(autobaseKey, 'base64') : undefined,
        blindEncryptionKey: newBlindKeyBase64,
        oldBlindEncryptionKey: oldBlindKeyBase64,
      })
      await reopened.ready()
      this.spaces.set(spaceId, reopened)
      console.log('[SpaceManager] Blind key rotated for space:', spaceId)
    }
    this._blindEncryptionKey = newBlindKeyBase64
    console.log('[SpaceManager] Blind key rotation complete')
  }

  /**
   * Handle candidate pairing (joiner side)
   * @param {string} spaceId - Space ID
   * @param {string} invite - Base64-encoded invite code
   * @returns {Promise<{}>} Empty object
   */
  async joinSpaceViaPairing(spaceId, invite) {
    // Get local writer key from store - no need for frontend to provide it
    const namespacedStore = this.store.namespace(spaceId)
    const writerKey = await Autobase.getLocalKey(namespacedStore)
    const userData = Buffer.from(JSON.stringify({ writerKey: b4a.toString(writerKey, 'base64') }))
    
    console.log('[SpaceManager] Joining space via pairing:', spaceId)
    
    await namespacedStore.ready()

    this.swarm.on('connection', (conn, peerInfo) => {
      namespacedStore.replicate(conn)
    })

    const { autobaseKey, encryptionKey } = await new Promise((resolve, reject) => {
      const candidate = this.blindPairing.addCandidate({
        invite: z32.decode(invite),
        userData,
        async onadd(result) {
          console.log('[SpaceManager] Pairing complete, received autobaseKey + encryptionKey')
          resolve({
            autobaseKey: result.key,
            encryptionKey: b4a.toString(result.encryptionKey, 'base64')
          })
        }
      })
      
      // Wait for pairing to complete
      candidate.pairing.catch(reject)
    })
    
    console.log('[SpaceManager] Received autobaseKey, opening space:', spaceId)
    
    // Open the Space with received keys
    // encryptionKey from pairing is passed here so Autobase stores it encrypted by the blind key on first open
    const space = new Space(spaceId, namespacedStore, this.swarm, this.blindPairing, this.router, {
      key: autobaseKey,
      encryptionKey: encryptionKey,  // in-memory only; Autobase will persist it via blind encryption
      blindEncryptionKey: this._blindEncryptionKey,
    })
    
    // Don't call ready() yet — space must be saved to the DB before continuing
    this.spaces.set(spaceId, space)
    
    console.log('[SpaceManager] Joined space:', spaceId)
    return {}
  }
}

// Singleton
let manager = null

/**
 * Initialize SpaceManager singleton
 * @param {string} basePath - Filesystem path for Corestore
 * @param {object} router - Hyperdispatch router
 * @returns {SpaceManager} SpaceManager instance
 */
export function initialize(basePath, router) {
  if (!manager) {
    manager = new SpaceManager(basePath, router)
  }
  return manager
}

/**
 * Get SpaceManager singleton
 * @returns {SpaceManager} SpaceManager instance
 */
export function getManager() {
  return manager
}
