# RNS Goldsky Indexer

This subgraph indexes registrar, registry, and resolver events for `.rise`
names.

## Mainnet status

Stage0 targets RISE Mainnet (chain ID `4153`). Goldsky's supported-network
catalog currently lists only RISE Sepolia (`rise-sepolia`), so `subgraph.yaml`
remains a legacy testnet manifest and must not be deployed as a mainnet
indexer. Mainnet RNS data is indexed by the Senna API directly from the RISE
RPC in the meantime, and the frontend's Goldsky RNS endpoint is left blank.

When Goldsky adds RISE Mainnet support, update the manifest with the supported
network slug and these deployments:

| Contract | Address | Start block |
| --- | --- | ---: |
| RNSRegistrarV2 | `0xbCA437a93C2E7396a68Ce49BE224F65eE3CFd6Db` | 20079523 |
| RNSRegistryV2 | `0x6DDca710993C91402d52061868bE76043a4C5888` | 20079518 |
| RNSResolverV2 | `0x36D6383774631565AB0D8F3710748610631A675d` | 20079521 |

## ABI synchronization

The ABI JSON files are generated from the Foundry artifacts in the
smart-contracts repository. Run this after every contract change:

```bash
cd /path/to/stage0
npm run sync:abis
```

## Local verification

```bash
cd indexer/goldsky/rns
npm install
npm run codegen
npm run build
```
