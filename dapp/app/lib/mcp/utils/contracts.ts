/* dapp/app/lib/mcp/utils/contracts.ts */
import { createLogger } from '@logger';
import { getActiveChain, Chain } from '@config/chain';
import type { SupportedChain } from '@schemas/domain/chains';
import { getRpcUrl } from './chains';
import { callRPC } from './rpc';
import {
  Abi,
  Address,
  encodeFunctionData,
  decodeFunctionResult,
  encodeEventTopics,
  isHex,
  type Hex,
} from 'viem';

const logger = createLogger('mcp-contracts');

/** Map app's active Chain enum → SupportedChain string used by mcp utils */
export function resolveActiveSupportedChain(): SupportedChain {
  const active = getActiveChain();
  switch (active) {
    case Chain.RITONET:
      return 'ritonet';
    case Chain.SEPOLIA:
      return 'sepolia';
    case Chain.ETHEREUM:
    default:
      return 'mainnet';
  }
}

export function getActiveRpcUrl(): string {
  const chain = resolveActiveSupportedChain();
  const url = getRpcUrl(chain);
  logger.debug('Active RPC URL', { chain, url });
  return url;
}

/** Read-only contract call bound to the active network */
export async function callContract<T>({
  abi,
  address,
  functionName,
  args = [],
}: {
  abi: Abi;
  address: Address;
  functionName: string;
  args?: unknown[];
}): Promise<T> {
  const rpcUrl = getActiveRpcUrl();
  const data = encodeFunctionData(
    { abi, functionName, args } as Parameters<typeof encodeFunctionData>[0],
  );
  const result = await callRPC(rpcUrl, 'eth_call', [{ to: address, data }, 'latest']);

  if (typeof result !== 'string' || !isHex(result)) {
    throw new Error('Invalid eth_call result (expected hex string)');
  }

  // Cast to Hex so viem's types are happy
  return decodeFunctionResult({ abi, functionName, data: result as Hex }) as T;
}

/** Get latest block as bigint */
export async function getBlockNumber(): Promise<bigint> {
  const rpcUrl = getActiveRpcUrl();
  const hex = (await callRPC(rpcUrl, 'eth_blockNumber', [])) as unknown;
  if (typeof hex !== 'string' || !isHex(hex)) throw new Error('Invalid block number');
  return BigInt(hex);
}

/** Chunked log iterator for a single event (topic[0]) */
export async function* getEventLogsChunked(params: {
  address: Address;
  abi: Abi;
  eventName: string;
  fromBlock: bigint;
  toBlock: bigint;
  chunkSize?: bigint; // number of blocks per query (default 100k)
}) {
  const { address, abi, eventName, fromBlock, toBlock, chunkSize = 100_000n } = params;
  const rpcUrl = getActiveRpcUrl();

  const topics = encodeEventTopics({ abi, eventName });
  const topic0 = topics?.[0];
  if (!topic0) {
    throw new Error(`Unable to encode topic for event "${eventName}"`);
  }

  let start = fromBlock;
  while (start <= toBlock) {
    const end = start + chunkSize - 1n <= toBlock ? start + chunkSize - 1n : toBlock;

    const filter = {
      address,
      fromBlock: ('0x' + start.toString(16)) as Hex,
      toBlock: ('0x' + end.toString(16)) as Hex,
      topics: [topic0],
    };

    const logs = (await callRPC(rpcUrl, 'eth_getLogs', [filter])) as Array<{
      data: Hex;
      topics: Hex[];
      blockNumber: Hex;
      transactionHash: Hex;
    }>;

    yield logs;
    start = end + 1n;
  }
}
