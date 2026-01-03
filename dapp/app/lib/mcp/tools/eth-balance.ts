// dapp/app/lib/mcp/tools/eth-balance.ts
//
// ETH balance tool with RAW JSON Schema input (no Zod).
// Manual validation for address/chain. Exposes plain JSON Schema to the model.

import { createLogger } from '@logger';

import type { Tool } from '@schemas/domain/tool';
import { isSupportedChain, type SupportedChain } from '@schemas/domain/chains';

import { createTool, textResult, jsonResult } from './types';
import { getRpcUrl, isValidAddress, formatChainName } from '../utils/chains';
import { getBalance, formatEther } from '../utils/rpc';
import { fail, errorResultShape } from './tool-errors';
import type { ToolInputMap } from '@lib/mcp/generated/tool-catalog-types';

const logger = createLogger('eth-balance-tool');

// RAW JSON Schema for the tool input
const EthBalanceInputSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    address: {
      type: 'string',
      description: 'Ethereum-compatible address (0x...)',
      pattern: '^0x[a-fA-F0-9]{40}$',
    },
    chain: {
      type: 'string',
      description:
        'Target chain. One of mainnet, sepolia, polygon, arbitrum, avalanche, base, optimism, fantom, ritonet',
      enum: [
        'mainnet',
        'sepolia',
        'polygon',
        'arbitrum',
        'avalanche',
        'base',
        'optimism',
        'fantom',
        'ritonet',
      ],
      default: 'mainnet',
    },
  },
  required: ['address'],
};

type ToolParamsFromGenerated = ToolInputMap extends { ['get_eth_balance']: infer T } ? T : never;
type EthBalanceParams = [ToolParamsFromGenerated] extends [never]
  ? { address: string; chain?: SupportedChain | string }
  : ToolParamsFromGenerated;

// Tool implementation
const ethBalanceTool: (Tool<EthBalanceParams> & { __types?: ToolInputMap }) = {
  name: 'get_eth_balance',
  description:
    'Get the native token balance of an address on various EVM chains (Ethereum, L2s, testnets, local).',
  inputSchema: EthBalanceInputSchema,

  async handler(params: EthBalanceParams) {
    const address = String((params as { address?: unknown })?.address ?? '').trim();
    const chainRaw = String((params as { chain?: unknown })?.chain ?? 'mainnet');

    // Manual validation (fail fast so the chip shows ✖)
    if (!isValidAddress(address)) {
      fail('Invalid Ethereum address format');
    }
    if (!isSupportedChain(chainRaw)) {
      fail(
        `Unsupported chain: ${chainRaw}. Use one of mainnet, sepolia, polygon, arbitrum, avalanche, base, optimism, fantom, ritonet.`,
      );
    }
    const chain = chainRaw as SupportedChain;

    logger.info('Fetching balance', { address, chain });

    try {
      // Get RPC URL for the chain
      const rpcUrl = getRpcUrl(chain);

      // Fetch balance
      const balanceWei = await getBalance(rpcUrl, address);

      // Format balance
      const balanceEth = formatEther(balanceWei);
      const chainName = formatChainName(chain);

      // Native token symbol
      const tokenSymbol = getTokenSymbol(chain);

      logger.info('Balance fetched', {
        address,
        chain,
        balanceWei: balanceWei.toString(),
        balanceEth,
      });

      // 👉 Return BOTH: user-friendly one-liner (for model) + JSON (for UI)
      const text = textResult(
        `Address ${address} on ${chainName} has a balance of ${balanceEth} ${tokenSymbol}`
      );
      const json = jsonResult({
        address,
        chain,
        chainName,
        balanceWei: balanceWei.toString(),
        balanceEth,
        symbol: tokenSymbol,
      });

      return {
        content: [...text.content, ...json.content],
      };
    } catch (error: unknown) {
      logger.error('Failed to fetch balance', {
        address,
        chain,
        error: error instanceof Error ? error.message : String(error),
      });

      return errorResultShape(
        error instanceof Error ? error.message : 'Failed to fetch balance',
      );
    }
  },
};

// Get native token symbol for a chain
function getTokenSymbol(chain: SupportedChain): string {
  const symbols: Record<SupportedChain, string> = {
    mainnet: 'ETH',
    sepolia: 'ETH',
    polygon: 'MATIC',
    arbitrum: 'ETH',
    avalanche: 'AVAX',
    base: 'ETH',
    optimism: 'ETH',
    fantom: 'FTM',
    ritonet: 'ETH', // Assuming ritonet uses ETH
  };
  return symbols[chain] || 'ETH';
}

export default createTool(ethBalanceTool);
