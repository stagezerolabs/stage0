# NFT marketplace build plan

Status: draft pending the asset-scope, listing-model, and contract-repository decisions. See [the research note](./nft-marketplace-research.md) for standards, sources, and security rationale.

## Outcome and boundary

Stage0 gains a separate **NFT Marketplace** destination for discovering NFT collections and buying and selling individual tokens on RISE. The existing `/nfts/:address` mint page and `/domains/marketplace` Names marketplace keep their distinct purposes. A collection being mintable does not imply that its tokens are listed for resale.

## UX prototype before implementation

```text
Header: Launchpad | NFT Marketplace | Names ▾ | ...

NFT Marketplace
  [Search collections or token ID] [Collection filter] [Sort]
  [Listed NFTs] [Collections] [Activity]

  Listed NFTs: image, collection, token name/#, verified owner,
               sale price, listing state. Card -> token detail.
  Collections: image, name, minted supply, listed count and floor
               only when actual listings exist. Card -> collection browse.

Token detail
  Asset identity: RISE / contract / token ID
  Metadata + traits | owner | listing price | royalty/fee/proceeds
  Buyer: review latest listing state -> confirm wallet payment -> receipt
  Owner: set price -> approve/deposit or sign (model dependent)
         -> verify live listing -> cancel / withdraw

Empty states: no collections; collection has no minted tokens;
              minted tokens exist but none are listed; data service error.
```

Mobile navigation exposes NFT Marketplace as its own destination. Search and cards must never label mint price as resale price or show an actionable Buy button from collection-level mint data. Wallet actions show the contract address, asset, total payment, payout split, and approval scope before signing.

## Recommended first release

1. **Lock product rules.** Confirm whether the first release supports Stage0-created ERC-721 collections only (recommended) or arbitrary RISE contracts, and whether gas-paid fixed-price escrow (recommended) or signed noncustodial listings are required. Set platform fee and ERC-2981 royalty policy before contract design. These choices affect custody, fees, indexing, and the user flow.
2. **Establish the contract workspace.** Locate the NFT factory/collection source and contract test environment. Add a separate secondary-sale settlement contract, with explicit listing, purchase, cancellation, payout, and emergency behavior. Do not adapt the `.rise` name marketplace contract to NFT transfers. Review ownership, approvals, receiver callbacks, arithmetic, reentrancy, and withdrawal paths. Write adversarial tests before implementation and arrange an independent contract review before any mainnet action.
3. **Index token and market events.** Ingest ERC-721 transfers and settlement list/cancel/sale events from RISE. Maintain token identity `(chainId, collection, tokenId)`, owner, and listing status. Store ingest position and handle duplicate logs and reorgs. Serve paginated collection, token, listing, and activity queries. Confirm the indexer provider supports RISE mainnet; the existing launchpad Goldsky data does not provide this inventory.
4. **Build the UI against real data.** Add `/nft-marketplace`, collection browse, token detail, and owner listing management. Add the separate header destination. Reuse collection imagery and NFT metadata helpers where valid, but fetch owner and listing from token-level data. Gate write actions on supported chain and verified deployment. Re-read chain state and simulate a purchase before wallet confirmation; refresh after a confirmed receipt.
5. **Validate end to end.** Test mint/transfer/list/buy/cancel flows on a local EVM environment and on a non-production RISE target if available. Include stale listing, duplicate buy, revoked approval, malicious receiver, failed payout, wrong chain, and indexer lag. Check keyboard/mobile flows and accessible status messages. Mainnet deployment and broadcasts need separate exact approval.

## Release criteria

- A wallet can list a supported owned NFT, a second wallet can buy it atomically for the displayed total, and a seller can cancel and recover an unsold token.
- Discovery shows only actual listings as for sale and reflects sales, cancellations, transfers, and indexer delays correctly.
- Contract tests cover fund and custody invariants; the contract deployment and fee/royalty behavior are independently reviewed.
- The NFT Marketplace route and header are separate from Names and from primary NFT minting.

## Known dependencies

This repository currently contains the frontend and collection-level indexer, but no NFT secondary-sale settlement contract, order API, or token-level market index. The smart-contract source workspace is not present at the path referenced by the README. A functional trading launch therefore depends on locating or creating that workspace and deploying a reviewed contract. No trading UI should claim that buying and selling are live before those dependencies exist.
