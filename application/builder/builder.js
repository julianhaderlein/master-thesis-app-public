const HRPCBuilder = require('hrpc')
const Hyperschema = require('hyperschema')
const Hyperdispatch = require('hyperdispatch')
const path = require('path')
const fs = require('fs')

const { hrpcCommands } = require('./hrpc-commands')
const { p2pOperations } = require('./p2p-operations')

const SCHEMA_DIR = path.join(__dirname, '..', 'generated', 'spec', 'hyperschema')
const HRPC_DIR = path.join(__dirname, '..', 'generated', 'spec', 'hrpc')
const DISPATCH_DIR = path.join(__dirname, '..', 'generated', 'spec', 'hyperdispatch')

// Phase 1: Register all Hyperschemas and save to disk
// (HRPCBuilder and Hyperdispatch both read schemas from SCHEMA_DIR, so this must come first)
const schema = Hyperschema.from(SCHEMA_DIR)
const hrpcNs = schema.namespace('hrpc')
const p2pNs  = schema.namespace('p2p')

hrpcCommands.forEach(({ req, res }) => {
  if (req) hrpcNs.register({ name: req.schema, fields: req.fields })
  if (res) hrpcNs.register({ name: res.schema, fields: res.fields })
})

// Hyperschema and Hyperdispatch registration use bare names (without the @p2p/ namespace prefix)
// since the namespace object adds the prefix itself. We strip it here once.
p2pOperations.forEach(({ name, fields }) => {
  const baseName = name.replace('@p2p/', '')
  p2pNs.register({ name: baseName, fields })
})

Hyperschema.toDisk(schema)

// Phase 2: Register HRPC commands
const builder = HRPCBuilder.from(SCHEMA_DIR, HRPC_DIR)
const hrpcCommandsNs = builder.namespace('hrpc')

hrpcCommands.forEach(({ name, req, res, send }) => {
  if (!name) return
  hrpcCommandsNs.register({
    name,
    request: { name: `@hrpc/${req.schema}`, stream: false, ...(send && { send: true }) },
    ...(res && { response: { name: `@hrpc/${res.schema}`, stream: false } })
  })
})

HRPCBuilder.toDisk(builder)

// Phase 3: Register Hyperdispatch operations
const hyperdispatch = Hyperdispatch.from(SCHEMA_DIR, DISPATCH_DIR)
const p2pDispatchNs = hyperdispatch.namespace('p2p')

// Read existing dispatch.json to preserve stable IDs regardless of declaration order.
// Existing operations are registered first (sorted by their current ID), new ones are
// appended after — so inserting an op anywhere in p2pOperations never shifts existing IDs.
const dispatchJsonPath = path.join(DISPATCH_DIR, 'dispatch.json')
const existingDispatch = fs.existsSync(dispatchJsonPath)
  ? JSON.parse(fs.readFileSync(dispatchJsonPath, 'utf8'))
  : { schema: [] }

const existingIdByName = new Map(
  existingDispatch.schema.map(entry => [entry.name, entry.id])
)

const sortedOperations = [...p2pOperations].sort((a, b) => {
  const aId = existingIdByName.get(a.name)
  const bId = existingIdByName.get(b.name)
  if (aId !== undefined && bId !== undefined) return aId - bId
  if (aId !== undefined) return -1
  if (bId !== undefined) return 1
  return 0
})

sortedOperations.forEach(({ name }) => {
  const baseName = name.replace('@p2p/', '')
  p2pDispatchNs.register({ name: baseName, requestType: name })
})

Hyperdispatch.toDisk(hyperdispatch)
