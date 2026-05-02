// Field definition helpers.
// An optional second `flags` argument is spread into the field object, allowing
// any hyperschema field property (e.g. { useDefault: false }, { array: true })
// to be set without needing a separate helper per variation.
const stringArg  = (name, flags = {}) => ({ name, type: 'string',  ...flags })
const intArg  = (name, flags = {}) => ({ name, type: 'uint64',  ...flags })
const floatArg  = (name, flags = {}) => ({ name, type: 'float64', ...flags })
const boolArg = (name, flags = {}) => ({ name, type: 'bool',    ...flags })

/**
 * P2P operation name constants with full @p2p/ namespace prefix.
 * Defined as a static literal so VS Code can infer all keys and provide autocomplete.
 * Import and use these instead of writing '@p2p/...' string literals.
 */
const P2P = /** @type {const} */ ({
  SPACE_METADATA:      '@p2p/space-metadata',
  ADD_WRITER:          '@p2p/add-writer',
  ANNOUNCE_MEMBER:     '@p2p/announce-member',
  SHARE_TRANSACTION:   '@p2p/share-transaction',
  UNSHARE_TRANSACTION: '@p2p/unshare-transaction',
  UPDATE_TRANSACTION:  '@p2p/update-transaction',
  ADD_CATEGORY:        '@p2p/add-category',
  UPDATE_CATEGORY:     '@p2p/update-category',
})

/**
 * P2P operations with their inline schema field definitions.
 * Each entry co-locates the Hyperschema message type (via P2P.*) with its fields,
 * eliminating the need to keep two separate lists in sync.
 *
 * Entry shape:
 *   name   {string}  - full namespaced operation name from P2P.*
 *   fields {Array}   - Hyperschema field definitions
 */
const p2pOperations = [
  { name: P2P.SPACE_METADATA, fields: [stringArg('spaceName'), stringArg('ownerUsername'), intArg('createdAt')] },
  { name: P2P.ADD_WRITER,       fields: [stringArg('writerKey'), boolArg('isIndexer')] },
  { name: P2P.ANNOUNCE_MEMBER,  fields: [stringArg('peerId'), stringArg('role'), intArg('joinedAt')] },

  // Transactions
  { name: P2P.SHARE_TRANSACTION, fields: [
    stringArg('id'), stringArg('accountId'), floatArg('amount'), stringArg('type'), stringArg('categoryId'),
    stringArg('description'), intArg('date'), stringArg('notes'), stringArg('originPeerId'), intArg('timestamp'),
    stringArg('tagIds', { array: true }), stringArg('currency')
  ]},
  { name: P2P.UNSHARE_TRANSACTION, fields: [stringArg('transactionId'), stringArg('originPeerId'), intArg('timestamp')] },
  // Optional fields use { useDefault: false } so that absent fields decode as
  // `undefined` instead of the type's zero value. This lets the receiver
  // distinguish "field intentionally not updated" from "field set to empty",
  // which is critical for partial updates such as a tags-only change.
  { name: P2P.UPDATE_TRANSACTION, fields: [
    stringArg('transactionId'), stringArg('originPeerId'), intArg('timestamp'),
    floatArg('amount',      { useDefault: false }),
    stringArg('type',        { useDefault: false }),
    stringArg('categoryId',  { useDefault: false }),
    stringArg('description', { useDefault: false }),
    intArg('date',        { useDefault: false }),
    stringArg('notes',       { useDefault: false }),
    stringArg('tagIds',      { useDefault: false, array: true, record: false }),
  ]},

  // Categories
  { name: P2P.ADD_CATEGORY, fields: [
    stringArg('id'), stringArg('icon'), stringArg('color'), stringArg('originPeerId'), intArg('timestamp')
  ]},
  { name: P2P.UPDATE_CATEGORY, fields: [
    stringArg('categoryId'), stringArg('icon'), stringArg('color'), stringArg('originPeerId'), intArg('timestamp')
  ]}
]

module.exports = { p2pOperations, P2P }
