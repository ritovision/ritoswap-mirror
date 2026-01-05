// dapp/app/lib/mcp/tools/keynft-read/actions/balance.ts
import { textResult, jsonResult, errorResult } from '../../types';
import {
  logger,
  KEY_TOKEN_ADDRESS,
  fullKeyTokenAbi,
  callContract,
  activeNetworkName,
  shortAddr,
  OWNER_REGEX,
} from '../shared';
import { fail } from '../../tool-errors';

type Params = { owner?: string };
type CallArg<T> = Parameters<typeof callContract<T>>[0];

export async function handleBalance({ owner }: Params) {
  if (typeof owner !== 'string') {
    logger.warn('balanceOf aborted: no owner');
    return fail('Not signed in: connect your wallet to query balance.') as never;
  }
  if (!OWNER_REGEX.test(owner)) {
    logger.warn('balanceOf aborted: invalid owner address', { owner });
    return fail('Invalid address: expected a 0x-prefixed 20-byte address.') as never;
  }

  try {
    const balance = await callContract<bigint>({
      abi: fullKeyTokenAbi as unknown as CallArg<bigint>['abi'],
      address: KEY_TOKEN_ADDRESS,
      functionName: 'balanceOf',
      args: [owner],
    });

    const balanceStr = balance.toString();
    const networkName = activeNetworkName();
    const human = `${shortAddr(owner)} has ${balanceStr} ${balanceStr === '1' ? 'key' : 'keys'} on ${networkName} (${shortAddr(
      KEY_TOKEN_ADDRESS
    )})`;

    const text = textResult(human);
    const json = jsonResult({ address: KEY_TOKEN_ADDRESS, owner, balance: balanceStr, networkName });

    logger.info('balanceOf ok', { owner, balance: balanceStr, networkName });
    return { content: [...text.content, ...json.content] };
  } catch (e) {
    logger.error('balanceOf failed', { owner, err: String(e) });
    return errorResult(e instanceof Error ? e.message : 'Failed to read balance');
  }
}
