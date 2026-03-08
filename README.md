# Stage0
Launch layer on Sepolia (dev) with production-ready chain abstraction.

## Goldsky Rise indexer

This app supports fast launchpad reads from a Goldsky subgraph endpoint.

1. Build/deploy the indexer project at `indexer/goldsky/rise-launchpad`
2. Set `VITE_GOLDSKY_RISE_SUBGRAPH_URL` in `.env.local`
3. Restart `npm run dev`

If `VITE_GOLDSKY_RISE_SUBGRAPH_URL` is not set, or if the endpoint errors, the app falls back to direct onchain reads.
