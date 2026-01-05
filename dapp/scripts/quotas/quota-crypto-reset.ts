/**
 * CLI to reset **crypto** quota windows via the API (ACTIVE network only).
 *
 * Usage (pnpm + cross-env):
 *  - Reset ALL crypto quotas (global + all per-address for active network):
 *      pnpm tsx scripts/quota-crypto-reset.ts --all
 *      # with inline secret
 *      cross-env AI_QUOTA_RESET_SECRET=supersecret pnpm tsx scripts/quota-crypto-reset.ts --all
 *
 *  - Reset specific address(es) (comma-separated env):
 *      cross-env AI_QUOTA_RESET_SECRET=supersecret QUOTA_CRYPTO_ADDRESSES=0xabc...,0xdef... pnpm tsx scripts/quota-crypto-reset.ts
 *
 *  - Reset specific address(es) (positional args):
 *      cross-env AI_QUOTA_RESET_SECRET=supersecret pnpm tsx scripts/quota-crypto-reset.ts 0xabc... 0xdef...
 *
 * Optional:
 *  - Single-address env fallback:
 *      QUOTA_CRYPTO_ADDRESS=0xabc...
 *
 *  - Override API URL:
 *      cross-env RESET_API_URL=https://app.example.com/api/quota-reset ...
 */

import 'dotenv/config';

const API_URL = process.env.RESET_API_URL || 'http://localhost:3000/api/quota-reset';
const SECRET = process.env.AI_QUOTA_RESET_SECRET || '';

if (!SECRET) {
  console.error('AI_QUOTA_RESET_SECRET is required');
  process.exit(1);
}

// Simple 0x-address check (case-insensitive)
const isAddr = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s);

function parseArgs(): { all: boolean; addresses: string[] } {
  const args = process.argv.slice(2);
  const all = args.includes('--all');

  // env: QUOTA_CRYPTO_ADDRESSES=0x...,0x...
  const listEnv = (process.env.QUOTA_CRYPTO_ADDRESSES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // env: QUOTA_CRYPTO_ADDRESS=0x...
  const singleEnv = (process.env.QUOTA_CRYPTO_ADDRESS || '').trim();

  // positional addresses (non-flag args)
  const positional = args.filter((a) => !a.startsWith('-'));

  const addresses = all
    ? []
    : (listEnv.length ? listEnv : (singleEnv ? [singleEnv] : positional))
        .map((a) => a.toLowerCase())
        .filter(isAddr);

  return { all, addresses };
}

async function main() {
  const { all, addresses } = parseArgs();

  const payload = all
    ? { scope: 'crypto', all: true }
    : { scope: 'crypto', addresses };

  console.log(`[quota-crypto-reset] POST ${API_URL}`);
  console.log(
    `[quota-crypto-reset] Mode: ${
      all ? 'ALL (crypto, active network)' : `addresses [${addresses.join(', ')}]`
    }`
  );

  if (!all && addresses.length === 0) {
    console.error('Provide one or more addresses (env or positional) or use --all');
    process.exit(1);
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[quota-crypto-reset] Secret length: ${SECRET.length}`);
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-quota-reset-secret': SECRET,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    console.error(`Request failed (${res.status}):`, json);
    process.exit(1);
  }

  console.log(JSON.stringify(json, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
