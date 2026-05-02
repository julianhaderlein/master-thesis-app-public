import HRPC from '../generated/spec/hrpc'
import { P2P } from '../builder/p2p-operations.js'
import * as spaceManager from './services/space-manager.mjs'
import { registerHandlers, getRouter } from './services/operation-router.mjs'
import * as cryptoUtils from './services/crypto-utils.mjs'
import * as Path from 'bare-path'
import URL from 'bare-url'
import crypto from 'crypto'
import FramedStream from 'framed-stream'

const { IPC } = BareKit

const rpc = new HRPC(new FramedStream(IPC))

const path = Path.join(URL.fileURLToPath(Bare.argv[0]), 'prototype')

// Session state — set after successful authentication
let sessionBootstrapRecord = null  // { ciphertext, nonce, salt } — used for changePassword

// Create Hyperdispatch router and register handlers
registerHandlers(rpc)  // Pass frontend RPC for callbacks
const router = getRouter()

// Initialize SpaceManager with router
const manager = spaceManager.initialize(path, router)
await manager.ready()

console.log('[Backend] SpaceManager initialized')

// Notify frontend that backend is ready
rpc.backendReady()
console.log('[Backend] Sent ready notification to frontend')

// ── Authentication Handlers ──────────────────────────────────────────────────

rpc.onSetupPassword(async ({ password }) => {
    console.log('[Backend] Setting up password...')
    const blindKey = cryptoUtils.generateBlindEncryptionKey()
    const { hashedPassword, salt } = cryptoUtils.hashPassword(password)
    const { ciphertext, nonce } = cryptoUtils.encryptBlindKey(blindKey, hashedPassword)

    // Store in session
    sessionBootstrapRecord = { ciphertext, nonce, salt }
    manager.blindEncryptionKey = blindKey

    console.log('[Backend] Password setup complete')
    return { ciphertext, nonce, salt, hashedPassword }
})

rpc.onUnlockWithPassword(async ({ password, salt, ciphertext, nonce }) => {
    console.log('[Backend] Unlocking with password...')
    const { hashedPassword } = cryptoUtils.hashPassword(password, salt)
    const blindKey = cryptoUtils.decryptBlindKey(ciphertext, nonce, hashedPassword)
    if (!blindKey) {
        throw new Error('Invalid password')
    }

    sessionBootstrapRecord = { ciphertext, nonce, salt }
    manager.blindEncryptionKey = blindKey

    console.log('[Backend] Unlocked with password')
    return { hashedPassword }
})

rpc.onUnlockWithCredentials(async ({ ciphertext, nonce, hashedPassword }) => {
    console.log('[Backend] Unlocking with biometric credentials...')
    const blindKey = cryptoUtils.decryptBlindKey(ciphertext, nonce, hashedPassword)
    if (!blindKey) {
        throw new Error('Invalid credentials — blind key decryption failed')
    }

    // Reconstruct bootstrap record from the ciphertext/nonce (salt not needed for biometric path)
    sessionBootstrapRecord = { ciphertext, nonce, salt: null }
    manager.blindEncryptionKey = blindKey

    console.log('[Backend] Unlocked with credentials')
    return {}
})

rpc.onChangePassword(async ({ oldPassword, newPassword }) => {
    console.log('[Backend] Changing password...')
    if (!sessionBootstrapRecord) {
        return { success: false, newCiphertext: '', newNonce: '', newSalt: '', newHashedPassword: '' }
    }
    const { ciphertext, nonce, salt } = sessionBootstrapRecord

    // 1. Verify old password
    const { hashedPassword: oldHashedPassword } = cryptoUtils.hashPassword(oldPassword, salt)
    const existingBlindKey = cryptoUtils.decryptBlindKey(ciphertext, nonce, oldHashedPassword)
    if (!existingBlindKey) {
        return { success: false, newCiphertext: '', newNonce: '', newSalt: '', newHashedPassword: '' }
    }

    // 2. Derive new key with NEW random salt
    const { hashedPassword: newHashedPassword, salt: newSalt } = cryptoUtils.hashPassword(newPassword)

    // 3. Generate a NEW blind key (forward secrecy)
    const newBlindKey = cryptoUtils.generateBlindEncryptionKey()

    // 4. Re-encrypt all open Autobase instances with new blind key
    await manager.rotateBlindKey(newBlindKey)
    

    // 5. Wrap new blind key with new hashed password
    const { ciphertext: newCiphertext, nonce: newNonce } = cryptoUtils.encryptBlindKey(newBlindKey, newHashedPassword)

    // 6. Update session state
    sessionBootstrapRecord = { ciphertext: newCiphertext, nonce: newNonce, salt: newSalt }

    console.log('[Backend] Password changed')
    return { success: true, newCiphertext, newNonce, newSalt, newHashedPassword }
})

// Cleanup on exit
Bare.on('exit', async () => {
    console.log('[Backend] Received BARE exit signal, cleaning up...')
    console.log('[Backend] Cleaning up SpaceManager...')
    await manager.close()
})

// Space Management Handlers (new architecture)
rpc.onCreateSpace(async () => {
    console.log('[Backend] Creating new Space...')
    const spaceId = crypto.randomUUID()
    await manager.createSpace(spaceId)
    console.log('[Backend] Created Space:', spaceId)
    return { spaceId }
})

rpc.onOpenSpace(async ({ spaceId }) => {
    console.log('[Backend] Opening Space:', spaceId)
    await manager.openSpace(spaceId)
    console.log('[Backend] Opened Space:', spaceId)
    return {}
})

rpc.onCloseSpace(async ({ spaceId }) => {
    console.log('[Backend] Closing Space:', spaceId)
    await manager.closeSpace(spaceId)
    console.log('[Backend] Closed Space:', spaceId)
    return {}
})

rpc.onCreateSpaceInvite(async ({ spaceId }) => {
    console.log('[Backend] Creating Space invite for:', spaceId)
    const space = manager.getSpace(spaceId)
    if (!space) {
        throw new Error(`Space not found: ${spaceId}`)
    }
    
    // Space.createInvite() handles blind-pairing internally
    // No need to pass spaceName/username - just for invite generation
    const inviteCode = await space.createInvite()
    console.log('[Backend] Created invite for Space:', spaceId)
    return { inviteCode }
})

rpc.onJoinSpaceViaPairing(async ({ spaceId, invite }) => {
    console.log('[Backend] Joining Space via pairing:', spaceId)
    await manager.joinSpaceViaPairing(spaceId, invite)
    console.log('[Backend] Joined Space:', spaceId)
    return { success: true }
})

rpc.onFinalizeJoin(async ({ spaceId }) => {
    console.log('[Backend] Finalizing join for Space:', spaceId)
    const space = manager.getSpace(spaceId)

    await space.ready()
    console.log('[Backend] Finalized join for Space:', spaceId)
    return { success: true }
})

rpc.onAppendSpaceMetadata(async ({ spaceId, spaceName, ownerUsername }) => {
    console.log('[Backend] Appending space metadata:', spaceId, spaceName)
    const space = manager.getSpace(spaceId)
    if (!space) {
        throw new Error(`Space not found: ${spaceId}`)
    }
    
    await space.appendOperation(P2P.SPACE_METADATA, {
        spaceName,
        ownerUsername,
        createdAt: Date.now()
    })
    console.log('[Backend] Appended space metadata')
    return {}
})

rpc.onAppendMemberAnnouncement(async ({ spaceId, peerId, role }) => {
    console.log('[Backend] Appending member announcement:', spaceId, peerId, role)
    const space = manager.getSpace(spaceId)
    if (!space) {
        throw new Error(`Space not found: ${spaceId}`)
    }

    await space.appendOperation(P2P.ANNOUNCE_MEMBER, {
        peerId,
        role,
        joinedAt: Date.now()
    })
    console.log('[Backend] Appended member announcement for:', peerId)
    return {}
})

// P2P Operation Append Handlers (React Native → Bare) - legacy, use appendOperation instead
rpc.onAppendShareTransaction(async (data) => {
    console.log('[Backend] Appending share transaction:', data.id)
    
    const space = manager.getSpace(data.spaceId)
    if (!space) {
        throw new Error(`Space not found: ${data.spaceId}`)
    }

    console.log('Appending share transaction operation to space:', data.spaceId, 'operation ID:', data.id)
    
    // Append operation via Space
    await space.appendOperation(P2P.SHARE_TRANSACTION, {
        id: data.id,
        accountId: data.accountId,
        amount: data.amount,
        currency: data.currency,
        type: data.type,
        categoryId: data.categoryId,
        description: data.description ,
        date: data.date,
        notes: data.notes,
        originPeerId: data.originPeerId,
        timestamp: Date.now(),
        tagIds: data.tagIds
    })
    return {}
})

rpc.onAppendUnshareTransaction(async (data) => {
    console.log('[Backend] Appending unshare transaction:', data.transactionId)
    
    const space = manager.getSpace(data.spaceId)
    if (!space) {
        throw new Error(`Space not found: ${data.spaceId}`)
    }
    
    await space.appendOperation(P2P.UNSHARE_TRANSACTION, {
        transactionId: data.transactionId,
        originPeerId: data.originPeerId,
        timestamp: Date.now()
    })
    return {}
})

rpc.onAppendUpdateTransaction(async (data) => {
    console.log('[Backend] Appending update transaction:', data)
    
    const space = manager.getSpace(data.spaceId)
    if (!space) {
        throw new Error(`Space not found: ${data.spaceId}`)
    }
    
    await space.appendOperation(P2P.UPDATE_TRANSACTION, {
        transactionId: data.transactionId,
        amount: data.amount,
        categoryId: data.categoryId,
        description: data.description,
        date: data.date,
        notes: data.notes,
        originPeerId: data.originPeerId,
        timestamp: Date.now(),
        type: data.type,
        tagIds: data.tagIds
    })
    return {}
})