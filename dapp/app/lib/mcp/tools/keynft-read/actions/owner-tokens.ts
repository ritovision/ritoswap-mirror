/*
// dapp/app/lib/mcp/tools/keynft-read/actions/owner-tokens.ts
*/
import {
  logger,
  KEY_TOKEN_ADDRESS,
  fullKeyTokenAbi,
  callContract,
  OWNER_REGEX,
} from '../shared';
import { fail, errorResultShape } from '../../tool-errors';

type Params = { owner?: string };
type CallArg<T> = Parameters<typeof callContract<T>>[0];

function summarizeIds(ids: string[], cap = 10): string {
  if (ids.length === 0) return 'none';
  if (ids.length <= cap) return ids.map((id) => `#${id}`).join(', ');
  const head = ids.slice(0, cap).map((id) => `#${id}`).join(', ');
  return `${head} +${ids.length - cap} more`;
}

export async function handleOwnerTokens({ owner }: Params) {
  if (typeof owner !== 'string' || !OWNER_REGEX.test(owner)) {
    fail('Invalid owner address (must be 0x-prefixed 40-hex characters)');
  }
  if (/^0x0{40}$/i.test(owner)) {
    fail('Invalid owner address (zero address)');
  }

  try {
    const tokenIds = await callContract<bigint[]>({
      abi: fullKeyTokenAbi as unknown as CallArg<bigint[]>['abi'],
      address: KEY_TOKEN_ADDRESS,
      functionName: 'tokensOfOwner',
      args: [owner],
    });

    // 👇 explicit type for mapper param
    const ids = tokenIds.map((x: bigint) => x.toString());
    const count = ids.length;

    const summary =
      count === 0
        ? `Fetched Owner Tokens.\n${owner} holds 0 tokens`
        : `Fetched Owner Tokens.\n${owner} holds ${count} token${count === 1 ? '' : 's'}: ${summarizeIds(ids)}`;

    const payload = { address: KEY_TOKEN_ADDRESS, owner, tokenIds: ids, total: count };

    return { content: [{ type: 'text', text: summary }, { type: 'json', data: payload }] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to read tokensOfOwner';
    logger.error('tokensOfOwner failed', { owner, err: String(e) });
    return errorResultShape(msg);
  }
}
