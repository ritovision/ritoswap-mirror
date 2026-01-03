// dapp/app/lib/mcp/tools/keynft-read/actions/collection-info.ts
import { textResult, jsonResult } from '../../types';
import {
  logger,
  KEY_TOKEN_ADDRESS,
  fullKeyTokenAbi,
  callContract,
  activeNetworkName,
  shortAddr,
} from '../shared';
import { errorResult } from '../../types';

type CallArg<T> = Parameters<typeof callContract<T>>[0];

export async function handleCollectionInfo() {
  try {
    const [name, symbol] = await Promise.all([
      callContract<string>({
        abi: fullKeyTokenAbi as unknown as CallArg<string>['abi'],
        address: KEY_TOKEN_ADDRESS,
        functionName: 'name',
      }),
      callContract<string>({
        abi: fullKeyTokenAbi as unknown as CallArg<string>['abi'],
        address: KEY_TOKEN_ADDRESS,
        functionName: 'symbol',
      }),
    ]);

    const networkName = activeNetworkName();
    const human = `${name} (${symbol}) on ${networkName} — ${shortAddr(KEY_TOKEN_ADDRESS)}`;
    const text = textResult(human);
    const json = jsonResult({ address: KEY_TOKEN_ADDRESS, name, symbol, networkName });

    logger.info('collection info ok', { address: KEY_TOKEN_ADDRESS, name, symbol, networkName });
    return { content: [...text.content, ...json.content] };
  } catch (e) {
    logger.error('collection info failed', { err: String(e) });
    return errorResult(e instanceof Error ? e.message : 'Failed to read collection info');
  }
}
