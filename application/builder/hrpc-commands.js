// Field definition helpers.
// An optional second `flags` argument is spread into the field object, allowing
// any hyperschema field property (e.g. { useDefault: false }, { array: true })
// to be set without needing a separate helper per variation.
const stringArg  = (name, flags = {}) => ({ name, type: 'string',  ...flags })
const intArg  = (name, flags = {}) => ({ name, type: 'uint64',  ...flags })
const floatArg  = (name, flags = {}) => ({ name, type: 'float64', ...flags })
const boolArg = (name, flags = {}) => ({ name, type: 'bool',    ...flags })

/**
 * HRPC commands with their inline request/response schema definitions.
 * Each entry co-locates the Hyperschema field definitions with the HRPC command binding,
 * eliminating the need to keep two separate lists in sync.
 *
 * Entry shape:
 *   name  {string}  - HRPC command name (camelCase). Omit for schema-only entries.
 *   send  {bool}    - true for fire-and-forget (no awaited response)
 *   req   {object}  - { schema: string, fields: [] }
 *   res   {object}  - { schema: string, fields: [] }  (optional)
 */
const hrpcCommands = [
  // Backend ready check (Bare → React Native)
  {
    name: 'backendReady', send: true,
    req: { schema: 'backend-ready-request', fields: [] }
  },

  // Authentication + key derivation (React Native → Bare)
  {
    name: 'setupPassword',
    req: { schema: 'setup-password-request', fields: [stringArg('password')] },
    res: { schema: 'setup-password-response', fields: [
      stringArg('ciphertext'), stringArg('nonce'), stringArg('salt'), stringArg('hashedPassword')
    ]}
  },
  {
    name: 'unlockWithPassword',
    req: { schema: 'unlock-with-password-request', fields: [
      stringArg('password'), stringArg('salt'), stringArg('ciphertext'), stringArg('nonce')
    ]},
    res: { schema: 'unlock-with-password-response', fields: [stringArg('hashedPassword')] }
  },
  {
    name: 'unlockWithCredentials', send: true,
    req: { schema: 'unlock-with-credentials-request', fields: [
      stringArg('ciphertext'), stringArg('nonce'), stringArg('hashedPassword')
    ]}
  },
  {
    name: 'changePassword',
    req: { schema: 'change-password-request', fields: [stringArg('oldPassword'), stringArg('newPassword')] },
    res: { schema: 'change-password-response', fields: [
      boolArg('success'),
      stringArg('newCiphertext'),
      stringArg('newNonce'),
      stringArg('newSalt'),
      stringArg('newHashedPassword'),
    ]}
  },

  // Space management
  {
    name: 'createSpace',
    req: { schema: 'create-space-request',  fields: [] },
    res: { schema: 'create-space-response', fields: [stringArg('spaceId')] }
  },
  {
    name: 'openSpace', send: true,
    req: { schema: 'open-space-request', fields: [stringArg('spaceId')] }
  },
  {
    name: 'closeSpace', send: true,
    req: { schema: 'close-space-request', fields: [stringArg('spaceId')] }
  },
  {
    name: 'createSpaceInvite',
    req: { schema: 'create-space-invite-request',  fields: [stringArg('spaceId')] },
    res: { schema: 'create-space-invite-response', fields: [stringArg('inviteCode')] }
  },
  {
    name: 'joinSpaceViaPairing',
    req: { schema: 'join-space-via-pairing-request',  fields: [stringArg('spaceId'), stringArg('invite')] },
    res: { schema: 'join-space-via-pairing-response', fields: [boolArg('success')] }
  },
  {
    name: 'finalizeJoin',
    req: { schema: 'finalize-join-request',  fields: [stringArg('spaceId')] },
    res: { schema: 'finalize-join-response', fields: [boolArg('success')] }
  },
  {
    name: 'appendSpaceMetadata', send: true,
    req: { schema: 'append-space-metadata-request', fields: [stringArg('spaceId'), stringArg('spaceName'), stringArg('ownerUsername')] }
  },

  // Frontend callbacks (Bare → React Native)
  {
    name: 'updateSpaceMetadata', send: true,
    req: { schema: 'update-space-metadata-request', fields: [stringArg('spaceId'), stringArg('spaceName'), stringArg('ownerUsername')] }
  },
  {
    name: 'updateMemberAnnouncement', send: true,
    req: { schema: 'update-member-announcement-request', fields: [stringArg('spaceId'), stringArg('peerId'), stringArg('role'), intArg('joinedAt')] }
  },

  // Member announcement (React Native → Bare)
  {
    name: 'appendMemberAnnouncement', send: true,
    req: { schema: 'append-member-announcement-request', fields: [stringArg('spaceId'), stringArg('peerId'), stringArg('role')] }
  },

  // P2P operation append (React Native → Bare)
  {
    name: 'appendShareTransaction', send: true,
    req: { schema: 'append-share-transaction-request', fields: [
      stringArg('spaceId'), stringArg('id'), stringArg('accountId'), floatArg('amount'), stringArg('type'),
      stringArg('categoryId'), stringArg('description'), intArg('date'), stringArg('notes'), stringArg('originPeerId'),
      stringArg('tagIds', { array: true }), stringArg('currency')
    ]}
  },
  {
    name: 'appendUnshareTransaction', send: true,
    req: { schema: 'append-unshare-transaction-request', fields: [stringArg('spaceId'), stringArg('transactionId'), stringArg('originPeerId')] }
  },
  // Optional fields use { useDefault: false } — see p2p-operations.js UPDATE_TRANSACTION comment.
  {
    name: 'appendUpdateTransaction', send: true,
    req: { schema: 'append-update-transaction-request', fields: [
      stringArg('spaceId'), stringArg('transactionId'), stringArg('originPeerId'),
      floatArg('amount',      { useDefault: false }),
      stringArg('type',        { useDefault: false }),
      stringArg('categoryId',  { useDefault: false }),
      stringArg('description', { useDefault: false }),
      intArg('date',        { useDefault: false }),
      stringArg('notes',       { useDefault: false }),
      stringArg('tagIds',      { useDefault: false, array: true }),
    ]}
  },

  // P2P operation sync (Bare → React Native)
  {
    name: 'syncShareTransaction', send: true,
    req: { schema: 'sync-share-transaction-request', fields: [
      stringArg('spaceId'), stringArg('id'), stringArg('accountId'), floatArg('amount'), stringArg('type'),
      stringArg('categoryId'), stringArg('description'), intArg('date'), stringArg('notes'), stringArg('originPeerId'),
      stringArg('tagIds', { array: true }), stringArg('currency')
    ]}
  },
  {
    name: 'syncUnshareTransaction', send: true,
    req: { schema: 'sync-unshare-transaction-request', fields: [stringArg('spaceId'), stringArg('transactionId'), stringArg('originPeerId')] }
  },
  // Optional fields use { useDefault: false } — see p2p-operations.js UPDATE_TRANSACTION comment.
  {
    name: 'syncUpdateTransaction', send: true,
    req: { schema: 'sync-update-transaction-request', fields: [
      stringArg('spaceId'), stringArg('transactionId'), stringArg('originPeerId'),
      floatArg('amount',      { useDefault: false }),
      stringArg('type',        { useDefault: false }),
      stringArg('categoryId',  { useDefault: false }),
      stringArg('description', { useDefault: false }),
      intArg('date',        { useDefault: false }),
      stringArg('notes',       { useDefault: false }),
      stringArg('tagIds',      { useDefault: false, array: true }),
    ]}
  },

  // Schema-only entry (no command) — reserved response type
  { res: { schema: 'sync-success-response', fields: [boolArg('success')] } }
]

module.exports = { hrpcCommands }
