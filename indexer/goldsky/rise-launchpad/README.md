# Rise Launchpad Goldsky Indexer

This subgraph indexes:
- Presale lifecycle data from `PresaleFactory` + dynamic `LaunchpadPresale` instances
- NFT collection deployments and state from `NFTFactory` + dynamic collection contracts

## Networks and contracts

- Network: `rise-sepolia`
- PresaleFactory: `0x67064a9236050D3d947d7F5Bd3448BD4b5D947FC`
- NFTFactory: `0x6DDca710993C91402d52061868bE76043a4C5888`

## Local commands

```bash
cd indexer/goldsky/rise-launchpad
npm install
npm run codegen
npm run build
```

## Deploy to Goldsky

Use your API key without committing it:

```bash
cd indexer/goldsky/rise-launchpad
export GOLDSKY_API_KEY="<your-api-key>"
npx @goldskycom/cli@latest subgraph deploy risepad-rise-launchpad/1.0.1 --path . --tag latest --token "$GOLDSKY_API_KEY"
```

After deploy, copy the Goldsky GraphQL URL from the CLI output and set it in app env:

```bash
# at repo root
cat > .env.local <<'ENV'
VITE_GOLDSKY_RISE_SUBGRAPH_URL="https://..."
ENV
```

Then restart the frontend dev server.

## Current deployment

- Subgraph: `risepad-rise-launchpad/1.0.1`
- Tag: `latest`
- GraphQL: `https://api.goldsky.com/api/public/project_cmmi6ls0mkbq401xt89v63pbh/subgraphs/risepad-rise-launchpad/latest/gn`
