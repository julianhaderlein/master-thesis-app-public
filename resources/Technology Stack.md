# Technology stack
Goal is to build a local first p2p personal financing app.

## P2P networking
* Handled by pear/bare and its subcomponents from the Holepunch ecosystem.

### Core Components

#### Autobase (https://github.com/holepunchto/autobase)
* Each Space corresponds to an **autobase instance**.
* Autobase is a multiwriter data structure that combines multiple writer cores into a view of the system.
* Uses the event sourcing pattern - writers append blocks which are linearized into an eventually consistent order.
* Key features:
  * **Automatic reordering**: As new causal information comes in, nodes may be reordered when causal forks occur.
  * **Signed length**: Defines checkpoints after which ordering never changes, allowing fast catchup for peers behind.
  * **Apply function**: Deterministically updates views based on linearized writer nodes.
  * Upon coming back online, a peer can automatically fetch only the new (unknown) data that was shared while the peer was offline.

#### Hyperdispatch (https://github.com/holepunchto/hyperdispatch)
* Manages "operations" being sent over the autobase.
* Generates operations/endpoints using Hyperschema for type-safe communication.
* Provides a Router pattern for dispatching encoded messages to registered handlers.
* Think of it as the RPC/command layer on top of autobase - defines what operations peers can perform.
* Each Space's autobase uses hyperdispatch to define and route financial operations (add transaction, update category, etc.).

#### Blind-pairing (https://github.com/holepunchto/blind-pairing)
* Securely exchanges the autobase key for peers to join a Space.
* Uses HyperDHT for blind pairing without requiring direct connectivity.
* Workflow:
  1. Space creator generates an invite containing the autobase key.
  2. Candidate uses invite to request pairing.
  3. Space member verifies and confirms the candidate.
  4. Candidate receives autobase key and can join the Space.

## "DB" storage
* Data is not stored in a central db, but rather distributed on all clients.
* Local database: SQLite with SQLCipher encryption, interfaced with Drizzle ORM.
* Each peer maintains their own local copy of the data.
* Autobase handles the distributed sync and eventual consistency between peers.
* Could be expanded on later with Vector search, etc.