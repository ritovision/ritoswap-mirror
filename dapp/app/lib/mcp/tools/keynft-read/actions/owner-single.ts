// dapp/app/lib/mcp/tools/keynft-read/actions/owner-single.ts
import {
  logger,
  KEY_TOKEN_ADDRESS,
  onePerWalletAbi,
  callContract,
  OWNER_REGEX,
} from '../shared';
import { fail, errorResultShape } from '../../tool-errors';

type Params = { owner?: string };
type CallArg<T> = Parameters<typeof callContract<T>>[0];

export async function handleOwnerSingle({ owner }: Params) {
  if (typeof owner !== 'string' || !OWNER_REGEX.test(owner)) {
    fail('Invalid owner address (must be 0x-prefixed 40-hex characters)');
  }

  try {
    const tuple = await callContract<[bigint, boolean]>({
      abi: onePerWalletAbi as unknown as CallArg<[bigint, boolean]>['abi'],
      address: KEY_TOKEN_ADDRESS,
      functionName: 'getTokenOfOwner',
      args: [owner],
    });

    const tokenId = tuple?.[0];
    const hasToken = tuple?.[1] ?? false;

    const tokenIdStr = tokenId !== undefined && tokenId !== null ? tokenId.toString() : '';
    const summary = hasToken
      ? `Fetched Key Ownership.\n${owner} has key #${tokenIdStr}`
      : `Fetched Key Ownership.\n${owner} has no key`;

    const payload = { address: KEY_TOKEN_ADDRESS, owner, tokenId: tokenIdStr, hasToken };

    return { content: [{ type: 'text', text: summary }, { type: 'json', data: payload }] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to read getTokenOfOwner';
    logger.error('getTokenOfOwner failed', { owner, err: String(e) });
    return errorResultShape(msg);
  }
}
