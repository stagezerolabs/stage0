# Stage0
Launch layer on RISE testnet (dev) with production-ready chain abstraction.

## Deploy on Cloudflare Pages

This repo is a Vite SPA, so Cloudflare Pages is the correct Cloudflare product for it.

1. Push the repo to GitHub/GitLab.
2. In Cloudflare, go to `Workers & Pages` > `Create` > `Pages` > `Connect to Git`.
3. Select this repository and use:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/`
4. In `Settings` > `Variables and Secrets`, add the same client build variables you use locally:
   - `VITE_SEPOLIA_RPC_URL`
   - `VITE_OWNER_ADDRESS`
   - `VITE_GOLDSKY_RISE_SUBGRAPH_URL`
5. Deploy.

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

This app supports fast launchpad reads from a Goldsky subgraph endpoint.

1. Build/deploy the indexer project at `indexer/goldsky/rise-launchpad`
2. Set `VITE_GOLDSKY_RISE_SUBGRAPH_URL` in `.env.local`
3. Restart `npm run dev`

If `VITE_GOLDSKY_RISE_SUBGRAPH_URL` is not set, or if the endpoint errors, the app falls back to direct onchain reads.
