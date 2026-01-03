## RitoSwap Cloudflare Worker

This folder contains the Worker project that backs all durable state for the dapp
plus the Brevo email relay. It is intentionally isolated from the Next.js app to
avoid leaking worker-only dependencies into the main bundle.

### Structure

```
cloudflare/
├── package.json          # wrangler/vitest tooling
├── wrangler.toml         # worker + durable object config
├── src/
│   ├── index.ts          # entry that routes /state vs / email requests
│   ├── routes/
│   │   ├── state.ts      # auth + dispatch into the durable object
│   │   └── email.ts      # Brevo relay endpoint
│   └── durable/state.ts  # Durable Object implementation (nonces, quotas, rate limits)
└── tsconfig.json
```

### Getting started

```bash
cd cloudflare
pnpm install
pnpm dev         # wrangler dev with local durable object
pnpm test        # vitest coverage for worker logic
pnpm deploy      # wrangler deploy (requires Cloudflare account)
pnpm secret:all  # upload each secret required
```

### Environment

Set the following vars via `wrangler secret put` (or the dashboard):

| Variable | Purpose |
| --- | --- |
| `BREVO_API_KEY` | API key used when relaying emails |
| `SENDER_EMAIL` / `RECEIVER_EMAIL` | Notification routing |
| `STATE_SERVICE_AUTH_TOKEN` | Shared secret between the Next.js app and `/state` endpoint |

The durable object binding (`STATE_STORE`) and migrations are defined in
`wrangler.toml`. Update `STATE_SERVICE_AUTH_TOKEN` in both Cloudflare and the
Next.js `.env` to keep requests authenticated.

From this directory you can set each secret with:

```bash
pnpm secret:brevo     # wrangler secret put BREVO_API_KEY
pnpm secret:sender    # wrangler secret put SENDER_EMAIL
pnpm secret:receiver  # wrangler secret put RECEIVER_EMAIL
pnpm secret:state     # wrangler secret put STATE_SERVICE_AUTH_TOKEN
```

Or run everything in sequence with:

```bash
pnpm secret:all
```
