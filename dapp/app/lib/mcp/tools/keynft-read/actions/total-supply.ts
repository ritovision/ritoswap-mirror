/*
// dapp/app/lib/mcp/tools/keynft-read/actions/total-supply.ts
*/
import { textResult, jsonResult } from '../../types';
import {
  logger,
  KEY_TOKEN_ADDRESS,
  fullKeyTokenAbi,
  callContract,
  activeNetworkName,
  shortAddr,
} from '../shared';
import { errorResultShape } from '../../tool-errors';

type CallArg<T> = Parameters<typeof callContract<T>>[0];

export async function handleTotalSupply() {
  try {
    const totalSupply = await callContract<bigint>({
      abi: fullKeyTokenAbi as unknown as CallArg<bigint>['abi'],
      address: KEY_TOKEN_ADDRESS,
      functionName: 'totalSupply',
    });

    const totalSupplyStr = totalSupply.toString();
    const networkName = activeNetworkName();
    const human = `Key NFT total supply on ${networkName}: ${totalSupplyStr} (${shortAddr(
      KEY_TOKEN_ADDRESS
    )})`;

    const text = textResult(human);
    const json = jsonResult({ address: KEY_TOKEN_ADDRESS, totalSupply: totalSupplyStr, networkName });

    logger.info('totalSupply ok', { address: KEY_TOKEN_ADDRESS, totalSupply: totalSupplyStr, networkName });
    return { content: [...text.content, ...json.content] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to read totalSupply';
    logger.error('totalSupply failed', { err: String(e) });
    return errorResultShape(msg);
  }
}
