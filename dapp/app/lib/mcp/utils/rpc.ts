/* dapp/app/lib/mcp/utils/rpc.ts */
import { createLogger } from '@logger';
import {
  RPCResponseSchema,
  type RPCRequest,
} from '@schemas/dto/rpc';

const logger = createLogger('mcp-rpc');

let requestId = 0;

/**
 * Make an RPC call to an Ethereum node
 */
export async function callRPC<TResult = unknown>(
  rpcUrl: string,
  method: string,
  params: unknown[] = [],
  options: { timeout?: number } = {},
): Promise<TResult> {
  const rid = `rpc-${++requestId}`;
  const timeout = options.timeout || 30000;

  logger.debug('RPC call', { rid, method, rpcUrl, params });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const rpcRequest: RPCRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: rid,
    };

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpcRequest),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as unknown;
    const validatedResponse = RPCResponseSchema.parse(data);

    if (validatedResponse.error) {
      logger.error('RPC error', { rid, error: validatedResponse.error });
      throw new Error(`RPC error ${validatedResponse.error.code}: ${validatedResponse.error.message}`);
    }

    logger.debug('RPC success', { rid, result: validatedResponse.result });
    return validatedResponse.result as TResult;
  } catch (error) {
    if (
      error instanceof Error &&
      typeof (error as { name?: unknown }).name === 'string' &&
      (error as { name?: string }).name === 'AbortError'
    ) {
      logger.error('RPC timeout', { rid, method, timeout });
      throw new Error(`RPC request timeout after ${timeout}ms`);
    }

    logger.error('RPC call failed', {
      rid,
      method,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get ETH balance for an address
 */
export async function getBalance(rpcUrl: string, address: string): Promise<bigint> {
  const result = await callRPC<string>(rpcUrl, 'eth_getBalance', [address, 'latest']);

  if (typeof result !== 'string') {
    throw new Error('Invalid balance response');
  }

  return BigInt(result);
}

/**
 * Format wei to ETH with specified decimals
 */
export function formatEther(wei: bigint, decimals: number = 4): string {
  const divisor = BigInt(10 ** 18);
  const quotient = wei / divisor;
  const remainder = wei % divisor;

  const decimalPart = remainder.toString().padStart(18, '0');
  const truncatedDecimal = decimalPart.slice(0, decimals);
  const trimmedDecimal = truncatedDecimal.replace(/0+$/, '');

  if (trimmedDecimal.length === 0) {
    return quotient.toString();
  }

  return `${quotient}.${trimmedDecimal}`;
}
