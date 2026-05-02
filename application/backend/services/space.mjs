/**
 * Space Class (Bare Runtime)
 * 
 * Encapsulates one Autobase instance + discovery + operations + pairing.
 * Each Space gets isolated storage via corestore.namespace(spaceId).
 * Inspired by autobonk pattern.
 */

import Autobase from 'autobase'
import BlindEncryptionSodium from 'blind-encryption-sodium'
import b4a from 'b4a'
import { P2P } from '../../builder/p2p-operations.js'
import z32 from 'z32'
import { encode } from '../../generated/spec/hyperdispatch/index.js'

export class Space {
  constructor(spaceId, store, swarm, blindPairing, router, options = {}) {
    this.spaceId = spaceId
    this.store = store  // Already namespaced by SpaceManager
    this.swarm = swarm
    this.blindPairing = blindPairing  // Shared BlindPairing instance
    this.router = router  // Hyperdispatch router for operation routing
    this.autobase = null
    this.discovery = null
    this.key = options.key  // Optional for opening existing Space
    this.encryptionKey = options.encryptionKey || null  // Only set during join flow (received via blind pairing)
    this.blindEncryptionKey = options.blindEncryptionKey || null  // Base64-encoded 32-byte key (device-local)
    this.oldBlindEncryptionKey = options.oldBlindEncryptionKey || null  // For blind key migration only
    this.member = null  // For handling invite confirmations
    this.activeInvite = null  // Store active invite code
    this._connectionListener = null  // Stored so it can be removed on close
  }

  async ready() {
    this.autobase = new Autobase(this.store, this.key,
      {
        open: (store) => store.get('view'),
        apply: this._createApplyHandler(),
        encrypt: true,
        encrypted: true,
        // Join flow only: pass received key so Autobase stores it encrypted by the blind key
        encryptionKey: this.encryptionKey ? Buffer.from(this.encryptionKey, 'base64') : undefined,
        // Blind encryption setup - if oldBlindEncryptionKey is provided, 
        // it will be used to decrypt existing encryptionKey and re-encrypt with new blind key
        blindEncryption: new BlindEncryptionSodium(
          Buffer.from(this.blindEncryptionKey, 'base64'),
          this.oldBlindEncryptionKey ? Buffer.from(this.oldBlindEncryptionKey, 'base64') : undefined
        )
      }
    )
    await this.autobase.ready()

    // Setup replication — store ref so we can remove it when closing
    this._connectionListener = (conn) => this.autobase.replicate(conn)
    this.swarm.on('connection', this._connectionListener)

    // Join swarm
    this.discovery = this.swarm.join(this.autobase.discoveryKey)
    await this.discovery.flushed()


    console.log('[Space] Ready:', this.spaceId)
  }

  async close() {
    // only close resources owned by this Space - swarm and blindPairing are shared
    console.log('[Space] Closing:', this.spaceId)
    if (this._connectionListener) {
      this.swarm.removeListener('connection', this._connectionListener)
      this._connectionListener = null
    }
    if (this.discovery) this.discovery.destroy()
    console.log('[Space] Closing autobase...')
    if (this.autobase) this.autobase.close()
    console.log('[Space] Closed:', this.spaceId)
  }

  /**
   * Get autobase key for this Space
   * @returns {string} Base64-encoded autobase key
   */
  get autobaseKey() {
    if (!this.autobase) {
      throw new Error('Autobase not ready - cannot get autobaseKey')
    }
    return b4a.toString(this.autobase.key, 'base64')
  }

  /**
   * Create blind-pairing invite
   * @returns {Promise<string>} Invite code (base64)
   */
  async createInvite() {
    // If an invite is already active, return the existing one
    if (this.activeInvite && this.member) {
      console.log('[Space] Returning existing invite for space:', this.spaceId)
      return this.activeInvite
    }

    const autobaseKey = this.autobaseKey
    if (!autobaseKey) throw new Error('Space not ready')

    // BlindPairing.createInvite is a static method
    const { invite, publicKey, discoveryKey } = this.blindPairing.constructor.createInvite(
      b4a.from(autobaseKey, 'base64')
    )

    // Setup member to handle confirmations
    const self = this
    this.member = this.blindPairing.addMember({
      discoveryKey,
      async onadd(candidate) {
        console.log('[Space] Candidate joined for space:', self.spaceId)
        candidate.open(publicKey)

        // Extract writerKey from candidate's userData
        const userData = JSON.parse(candidate.userData.toString())
        const writerKey = userData.writerKey

        // Confirm - sends autobaseKey and encryptionKey to candidate
        // encryptionKey is read directly from the Autobase instance (set after ready())
        candidate.confirm({ key: b4a.from(autobaseKey, 'base64'), encryptionKey: self.autobase.encryptionKey })

        console.log('[Space] Confirmed candidate, appending add-writer operation')

        // Append add-writer operation to Autobase
        await self.appendOperation(P2P.ADD_WRITER, {
          writerKey: writerKey,
          isIndexer: false
        })
      }
    })

    await this.member.flushed()

    // Cache the invite code (z32 encoded - URL-safe, human-friendly)
    const inviteCode = z32.encode(invite)
    this.activeInvite = inviteCode

    console.log('[Space] Created invite for space:', this.spaceId)
    return inviteCode
  }

  /**
   * Append operations to Autobase
   * @param {string} type - Operation type
   * @param {object} operation - Operation to append
   */
  async appendOperation(type, operation) {
    console.log('[Space] Appending operation:', type, 'to space:', this.spaceId)
    let encoded
    try {
      encoded = encode(type, operation)
    } catch (error) {
      console.error('[Space] Error appending operation:', error)
      throw error
    }
    console.log('Encoded operation for append:', type, encoded.length, 'bytes');
    await this.autobase.append(encoded)
    console.log('[Space] Appended operation:', type, 'to space:', this.spaceId)
  }

  /**
   * Apply handler processes ALL operations via Hyperdispatch
   * @returns {Function} Apply handler function
   */
  _createApplyHandler() {
    return async (batch, view, host) => {
      console.log('[Space] Processing batch of', batch.length, 'operations for space:', this.spaceId)
      for (const node of batch) {
        // Router.dispatch() decodes and routes operations automatically
        await this.router.dispatch(node.value, {
          spaceId: this.spaceId,
          host: host,
          view: view,
          autobase: this.autobase
        })

        await view.append(node.value)
      }
    }
  }
}
