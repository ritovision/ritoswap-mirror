/**
 * CLI to reset **token** (LLM) quota windows via the API.
 *
 * Usage (pnpm + cross-env):
 *  - Reset ALL token quotas:
 *      pnpm tsx scripts/quota-token-reset.ts --all
 *      # with inline secret
 *      cross-env AI_QUOTA_RESET_SECRET=supersecret pnpm tsx scripts/quota-token-reset.ts --all
 *
 *  - Reset specific tokenIds (comma-separated env):
 *      cross-env AI_QUOTA_RESET_SECRET=supersecret QUOTA_TOKEN_IDS=123,456 pnpm tsx scripts/quota-token-reset.ts
 *
 *  - Reset specific tokenIds (positional args):
 *      cross-env AI_QUOTA_RESET_SECRET=supersecret pnpm tsx scripts/quota-token-reset.ts 123 456
 *
 * Optional:
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

function parseArgs(): { all: boolean; tokenIds: string[] } {
  const args = process.argv.slice(2);
  const all = args.includes('--all');

  const fromEnv = (process.env.QUOTA_TOKEN_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // positional args that are not flags
  const positional = args.filter((a) => !a.startsWith('-'));

  const tokenIds = all ? [] : (fromEnv.length ? fromEnv : positional);
  return { all, tokenIds };
}

async function main() {
  const { all, tokenIds } = parseArgs();

  const payload = all
    ? { scope: 'token', all: true }
    : { scope: 'token', tokenIds };

  console.log(`[quota-token-reset] POST ${API_URL}`);
  console.log(`[quota-token-reset] Mode: ${all ? 'ALL (token)' : `IDs [${tokenIds.join(', ')}]`}`);

  if (!all && tokenIds.length === 0) {
    console.error('Provide token IDs (QUOTA_TOKEN_IDS or positional) or use --all');
    process.exit(1);
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[quota-token-reset] Secret length: ${SECRET.length}`);
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
