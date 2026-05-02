/**
 * Operation Router Service (Bare Runtime)
 * 
 * Uses generated Hyperdispatch Router to route incoming P2P operations.
 * Operations are received from Autobase, encoded as buffers, then dispatched to handlers.
 */

import { Router, encode } from '../../generated/spec/hyperdispatch/index.js'
import b4a from 'b4a'
import { P2P } from '../../builder/p2p-operations.js'

/**
 * Reference to RPC client for calling React Native
 * Will be set by backend.mjs
 */
let rpcClient = null

/**
 * Create router instance
 */
const router = new Router()

/**
 * Set RPC client for calling React Native handlers
 * @param {object} rpc - HRPC client instance
 */
export function setRpcClient(rpc) {
  rpcClient = rpc
  console.log('[Router] RPC client set for React Native calls')
}

/**
 * Register operation handlers that update frontend SQLite
 * @param {object} frontendRpc - HRPC client for calling React Native
 */
export function registerHandlers(frontendRpc) {
  // Handle space metadata - call frontend to update SQLite
  router.add(P2P.SPACE_METADATA, async (data, context) => {
    const { spaceId } = context
    console.log('[Hyperdispatch] Received space-metadata for space:', spaceId, data.spaceName)
    
    // Call frontend to update Space record in SQLite
    await frontendRpc.updateSpaceMetadata({
      spaceId,
      spaceName: data.spaceName,
      ownerUsername: data.ownerUsername
    })
    
    console.log('[Hyperdispatch] Updated metadata for space:', spaceId, data.spaceName)
  })
  
  // Handle add-writer - CRITICAL: must call host.addWriter() in apply context
  router.add(P2P.ADD_WRITER, async (data, context) => {
    const { spaceId, host } = context
    const writerKey = b4a.from(data.writerKey, 'base64')
    
    console.log('[Hyperdispatch] Adding writer for space:', spaceId, data.writerKey.slice(0, 16))
    
    // addWriter must be called within the apply handler context
    await host.addWriter(writerKey, { indexer: data.isIndexer || false })
    
    console.log('[Hyperdispatch] Added writer for space:', spaceId, data.writerKey.slice(0, 16))
  })
  
  // Handle share-transaction - call frontend to update SQLite
  router.add(P2P.SHARE_TRANSACTION, async (operation, context) => {
    const { spaceId } = context
    console.log('[Hyperdispatch] Received share-transaction:', operation.id, 'for space:', spaceId)
    
    try {
      await frontendRpc.syncShareTransaction({
        spaceId: spaceId,
        id: operation.id,
        accountId: operation.accountId || '',
        amount: operation.amount,
        currency: operation.currency,
        type: operation.type,
        categoryId: operation.categoryId || '',
        description: operation.description || '',
        date: operation.date,
        notes: operation.notes || '',
        originPeerId: operation.originPeerId,
        tagIds: operation.tagIds || []
      })
    } catch (error) {
      console.error('[Hyperdispatch] Failed to forward share-transaction to React Native:', error)
    }
  })

  router.add(P2P.UNSHARE_TRANSACTION, async (operation, context) => {
    console.log('[Hyperdispatch] Received unshare-transaction:', operation)
    
    try {
      await frontendRpc.syncUnshareTransaction({
        spaceId: context.spaceId,
        transactionId: operation.transactionId,
        originPeerId: operation.originPeerId
      })
    } catch (error) {
      console.error('[Hyperdispatch] Failed to forward unshare-transaction to React Native:', error)
    }
  })

  router.add(P2P.ANNOUNCE_MEMBER, async (data, context) => {
    const { spaceId } = context
    console.log('[Hyperdispatch] Received announce-member for space:', spaceId, data.peerId)
    
    try {
      await frontendRpc.updateMemberAnnouncement({
        spaceId,
        peerId: data.peerId,
        role: data.role,
        joinedAt: data.joinedAt
      })
    } catch (error) {
      console.error('[Hyperdispatch] Failed to forward announce-member to React Native:', error)
    }
  })

  router.add(P2P.UPDATE_TRANSACTION, async (operation, context) => {
    console.log('[Hyperdispatch] Received update-transaction:', operation)

    try {
      // Pass values as-is — undefined fields were absent in the encoded message
      // (useDefault: false) and must stay undefined so the RN handler can skip them.
      await frontendRpc.syncUpdateTransaction({
        spaceId:       context.spaceId,
        transactionId: operation.transactionId,
        originPeerId:  operation.originPeerId,
        amount:        operation.amount,
        type:          operation.type,
        categoryId:    operation.categoryId,
        description:   operation.description,
        date:          operation.date,
        notes:         operation.notes,
        tagIds:        operation.tagIds,
      })
    } catch (error) {
      console.error('[Hyperdispatch] Failed to forward update-transaction to React Native:', error)
    }
  })

  router.add(P2P.ADD_CATEGORY, async (operation, context) => {
    console.log('[Hyperdispatch] Received add-category:', operation)
    // TODO: Send to React Native via HRPC
  })

  router.add(P2P.UPDATE_CATEGORY, async (operation, context) => {
    console.log('[Hyperdispatch] Received update-category:', operation)
    // TODO: Send to React Native via HRPC
  })
}

/**
 * Get router instance
 * @returns {Router} Router instance
 */
export function getRouter() {
  return router
}

/**
 * Encode operation to buffer for appending to Autobase
 * @param {string} operationName - Operation name (e.g. '@p2p/share-transaction')
 * @param {object} data - Operation data
 * @returns {Buffer} Encoded operation
 */
export function encodeOperation(operationName, data) {
  return encode(operationName, data)
}
