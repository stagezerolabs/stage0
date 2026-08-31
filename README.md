# Stage0
Launch layer on RISE Mainnet (chain ID `4153`).

## Deploy on Cloudflare Pages

This repo is a Vite SPA, so Cloudflare Pages is the correct Cloudflare product for it.

1. Push the repo to GitHub/GitLab.
2. In Cloudflare, go to `Workers & Pages` > `Create` > `Pages` > `Connect to Git`.
3. Select this repository and use:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/`
4. In `Settings` > `Variables and Secrets`, add the same client build variables you use locally:
   - `VITE_RISE_RPC_URL`
   - `VITE_OWNER_ADDRESS`
   - `VITE_GOLDSKY_RISE_SUBGRAPH_URL`
   - `VITE_RNS_SUBGRAPH_URL`
   - `VITE_SENNA_CHAT_API_URL`
5. Deploy.

Production values for the RISE Mainnet release:

```bash
VITE_RISE_RPC_URL=https://rpc.risechain.com
VITE_OWNER_ADDRESS=0x78d2e9D2B81D94ED27310d61e5f9e1C4db35fba5
VITE_SENNA_CHAT_API_URL=https://api.stage0.xyz
VITE_GOLDSKY_RISE_SUBGRAPH_URL=
VITE_RNS_SUBGRAPH_URL=
```

RISE Mainnet is the first and only configured wallet chain, so it is the
connection default. The header displays the local RISE network icon and chain
ID even before a wallet is connected. If a connected wallet is on another
chain, the route content is blocked behind an explicit switch-to-mainnet gate
so a mainnet contract address cannot be used on the wrong network.

Notes:
- `public/_redirects` already contains the SPA fallback (`/* /index.html 200`) required for React Router deep links.
- `public/_headers` is used by Cloudflare Pages for response headers after build.
- `netlify.toml` is ignored by Cloudflare Pages.

### Custom domain

After the first successful deploy:

1. Open the Pages project in Cloudflare.
2. Go to `Custom domains`.
3. Add your domain or subdomain.
4. If you are using the apex domain, move the domain's nameservers to Cloudflare first.
5. If you are using only a subdomain on external DNS, create a `CNAME` to `<your-project>.pages.dev`.

## Goldsky Rise indexer

This app supports fast launchpad reads from a Goldsky subgraph endpoint. As of
the RISE Mainnet launch, Goldsky lists only RISE Sepolia, so the mainnet
subgraph variables should remain blank and the app will use direct on-chain
reads plus the Senna RNS indexer.

Once Goldsky supports RISE Mainnet:

1. Update and deploy the indexer project at `indexer/goldsky/rise-launchpad`
2. Set `VITE_GOLDSKY_RISE_SUBGRAPH_URL` in `.env.local`
3. Restart `npm run dev`

If `VITE_GOLDSKY_RISE_SUBGRAPH_URL` is not set, or if the endpoint errors, the app falls back to direct onchain reads.

The production build also defaults Senna requests to `https://api.stage0.xyz`
if its build variable is accidentally omitted; development still defaults to
`http://localhost:8788`.

## Contract ABI synchronization

Frontend and indexer ABIs are generated from the Foundry artifacts:

```bash
npm run sync:abis
npm run check:abis
```

The script uses `../../Reactpad-tests/smart-contracts` by default. Set
`SMART_CONTRACTS_DIR` when the contracts repository lives elsewhere.
