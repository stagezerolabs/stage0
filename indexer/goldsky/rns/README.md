# RNS Indexer — Architecture Guidelines

This subgraph indexes the three RNS contracts on Rise Testnet and exposes a
GraphQL API that the frontend can query instead of doing expensive on-chain
reads for every page load.

---

## Contracts to watch

| Contract   | Address                                      | Start block |
|------------|----------------------------------------------|-------------|
| RNSRegistrar | `0x26F762137df7821369E95263f3EB556d96C4cEbB` | TBD         |
| RNSRegistry  | `0xa8d639540D11bd295d12a8F56DA5D2F53aBC0caF` | TBD         |
| RNSResolver  | `0x251c89457FbFF8930ae1D400C67E33B76498502b` | TBD         |

> Set `startBlock` to the deployment block of each contract. Using `0` works
> but re-indexes the entire chain and wastes sync time.

---

## Schema

```graphql
# One entity per registered label (e.g. "alice" for alice.rise)
type RnsDomain @entity(immutable: false) {
  id: ID!               # keccak256 node (hex)
  label: String!        # normalised label ("alice")
  fqdn: String!         # fully-qualified ("alice.rise")
  owner: Bytes!         # current registry owner
  resolver: Bytes       # resolver contract address (nullable until set)
  resolvedAddress: Bytes # addr(node) result (nullable)
  registrant: Bytes!    # address that called register()
  expiry: BigInt!       # unix timestamp from Registrar
  registeredAt: BigInt! # block timestamp of NameRegistered event
  renewedAt: BigInt     # block timestamp of last NameRenewed event
  releasedAt: BigInt    # set when NameReleased fires
  createdAtBlock: BigInt!
  updatedAtBlock: BigInt!
}

# Lightweight reverse-lookup — one record per address
# Populated when addr() on the resolver points to an owner
type RnsReverseRecord @entity(immutable: false) {
  id: ID!        # lowercase address
  domain: RnsDomain!
}
```

---

## Events to handle

### RNSRegistrar → `NameRegistered(string name, address owner, uint256 expiry)`
- Create or update `RnsDomain`
- Set `owner`, `registrant`, `expiry`, `registeredAt`
- Derive `fqdn` = `name + ".rise"`
- Derive `id` = `namehash(fqdn)` (compute in AssemblyScript with the
  ENS-compatible algorithm: iteratively keccak256 label + parent node)

### RNSRegistrar → `NameRenewed(string name, uint256 newExpiry)`
- Update `expiry` and `renewedAt` on existing `RnsDomain`

### RNSRegistrar → `NameReleased(string name)`
- Set `releasedAt`, zero out `owner` (or mark deleted)
- Remove related `RnsReverseRecord` if present

### RNSRegistry → `Transfer(bytes32 node, address owner)`
- Update `owner` on the matching `RnsDomain`

### RNSRegistry → `NewResolver(bytes32 node, address resolver)`
- Update `resolver` on the matching `RnsDomain`

### RNSResolver → `AddrChanged(bytes32 node, address addr)`
- Update `resolvedAddress` on the matching `RnsDomain`
- Upsert `RnsReverseRecord` keyed on `addr.toLowerCase()`

### RNSResolver → `TextChanged(bytes32 node, string key, string value)`
- Optional: store in a separate `RnsTextRecord` entity if you need
  key/value text records queryable by subgraph consumers.

---

## Folder layout (mirrors rise-launchpad)

```
indexer/goldsky/rns/
├── schema.graphql
├── subgraph.yaml
├── package.json
├── abis/
│   ├── RNSRegistrar.json    ← copy from src/lib/rns/abis/
│   ├── RNSRegistry.json
│   └── RNSResolver.json
└── src/
    ├── registrar.ts         ← NameRegistered, NameRenewed, NameReleased
    ├── registry.ts          ← Transfer, NewResolver
    └── resolver.ts          ← AddrChanged, TextChanged
```

---

## subgraph.yaml skeleton

```yaml
specVersion: 1.3.0
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum
    name: RNSRegistrar
    network: rise-sepolia
    source:
      address: "0x26F762137df7821369E95263f3EB556d96C4cEbB"
      abi: RNSRegistrar
      startBlock: <DEPLOYMENT_BLOCK>
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.9
      language: wasm/assemblyscript
      entities: [RnsDomain]
      abis:
        - name: RNSRegistrar
          file: ./abis/RNSRegistrar.json
      eventHandlers:
        - event: NameRegistered(string,address,uint256)
          handler: handleNameRegistered
        - event: NameRenewed(string,uint256)
          handler: handleNameRenewed
        - event: NameReleased(string)
          handler: handleNameReleased
      file: ./src/registrar.ts

  - kind: ethereum
    name: RNSRegistry
    network: rise-sepolia
    source:
      address: "0xa8d639540D11bd295d12a8F56DA5D2F53aBC0caF"
      abi: RNSRegistry
      startBlock: <DEPLOYMENT_BLOCK>
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.9
      language: wasm/assemblyscript
      entities: [RnsDomain]
      abis:
        - name: RNSRegistry
          file: ./abis/RNSRegistry.json
      eventHandlers:
        - event: Transfer(indexed bytes32,address)
          handler: handleTransfer
        - event: NewResolver(indexed bytes32,address)
          handler: handleNewResolver
      file: ./src/registry.ts

  - kind: ethereum
    name: RNSResolver
    network: rise-sepolia
    source:
      address: "0x251c89457FbFF8930ae1D400C67E33B76498502b"
      abi: RNSResolver
      startBlock: <DEPLOYMENT_BLOCK>
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.9
      language: wasm/assemblyscript
      entities: [RnsDomain, RnsReverseRecord]
      abis:
        - name: RNSResolver
          file: ./abis/RNSResolver.json
      eventHandlers:
        - event: AddrChanged(indexed bytes32,address)
          handler: handleAddrChanged
        - event: TextChanged(indexed bytes32,string,string)
          handler: handleTextChanged
      file: ./src/resolver.ts
```

---

## Namehash helper (AssemblyScript)

The node IDs stored in registry events are ENS-compatible namehash values.
Implement once in a shared `utils.ts`:

```typescript
import { crypto, ByteArray, Bytes } from "@graphprotocol/graph-ts";

// namehash("") = 0x000...000
// namehash("rise") = keccak256(namehash("") + keccak256("rise"))
// namehash("alice.rise") = keccak256(namehash("rise") + keccak256("alice"))
export function namehash(fqdn: string): Bytes {
  let node = new ByteArray(32); // zero bytes
  if (fqdn === "") return Bytes.fromByteArray(node);

  const labels = fqdn.split(".").reverse(); // ["rise", "alice"] → iterate tld first
  for (let i = 0; i < labels.length; i++) {
    const labelHash = crypto.keccak256(ByteArray.fromUTF8(labels[i]));
    const combined = new ByteArray(64);
    for (let j = 0; j < 32; j++) combined[j] = node[j];
    for (let j = 0; j < 32; j++) combined[32 + j] = labelHash[j];
    node = crypto.keccak256(combined);
  }
  return Bytes.fromByteArray(node);
}
```

Use `namehash(label + ".rise").toHexString()` as the entity `id`.

---

## Frontend integration plan

Once the subgraph is deployed on Goldsky, the frontend can replace these
expensive on-chain reads with fast GraphQL queries:

| Current on-chain call | Replaced by |
|-----------------------|-------------|
| `useRnsAvailable(label)` | `query { rnsDomain(id: $node) { owner expiry } }` — available if null |
| `useRnsOwner(label)` | same entity `.owner` field |
| `useRnsExpiry(label)` | same entity `.expiry` field |
| Reverse lookup (not yet on-chain) | `rnsReverseRecord(id: $address) { domain { label } }` |
| Listing all names for an address | `rnsDomains(where: { owner: $address, releasedAt: null })` |

Keep the wagmi hooks as the **write path** and as a fallback for fresh reads
right after a transaction confirms (invalidate the cache, re-read on-chain
once, then let the subgraph catch up within ~2 blocks).

---

## Deployment

```bash
# inside indexer/goldsky/rns
npm install
npx graph codegen        # generates AssemblyScript types from ABIs + schema
npx graph build          # compiles WASM
goldsky subgraph deploy rns/v1 --path .
```

Tag the deployed subgraph in `.env` / `config.ts`:

```ts
export const RNS_SUBGRAPH_URL =
  import.meta.env.VITE_RNS_SUBGRAPH_URL ??
  "https://api.goldsky.com/api/public/<PROJECT>/subgraphs/rns/v1/gn";
```

---

## Key constraints & gotchas

- **No reverse-lookup contract on Rise** — the `RnsReverseRecord` entity is
  the only way to map address → name. Populate it from `AddrChanged` events.
- **Label normalisation** — store labels lowercased and without the `.rise`
  suffix in the `label` field; store the full `fqdn` separately.
- **Expiry = 0 means released** — treat domains with `expiry < now` as
  unavailable in UI queries but do not delete them from the subgraph.
- **Re-registration after release** — `NameRegistered` can fire for the same
  label again; always upsert, never create-only.
- **startBlock matters** — get the exact deployment block from the Rise
  explorer to avoid syncing from genesis.
