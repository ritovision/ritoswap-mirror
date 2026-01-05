// dapp/app/schemas/domain/chains.ts
//
// Chain types and display constants with no env access.
// Keep RPC URLs and env-dependent logic in lib/mcp/utils/chains.ts.

import { z } from 'zod';

export const SupportedChainSchema = z.enum([
  'mainnet',
  'sepolia',
  'polygon',
  'arbitrum',
  'avalanche',
  'base',
  'optimism',
  'fantom',
  'ritonet',
] as const);

export type SupportedChain = z.infer<typeof SupportedChainSchema>;

export const CHAIN_DISPLAY_NAMES: Record<SupportedChain, string> = {
  mainnet: 'Ethereum',
  sepolia: 'Sepolia',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  avalanche: 'Avalanche',
  base: 'Base',
  optimism: 'Optimism',
  fantom: 'Fantom',
  ritonet: 'RitoNet',
};

export const CHAIN_NATIVE_SYMBOLS: Record<SupportedChain, string> = {
  mainnet: 'ETH',
  sepolia: 'ETH',
  polygon: 'MATIC',
  arbitrum: 'ETH',
  avalanche: 'AVAX',
  base: 'ETH',
  optimism: 'ETH',
  fantom: 'FTM',
  ritonet: 'ETH',
};

/** Type guard when you get arbitrary inputs (e.g., from user args). */
export function isSupportedChain(x: unknown): x is SupportedChain {
  return typeof x === 'string' && x in CHAIN_DISPLAY_NAMES;
}

/** Consistent display name for a chain. */
export function formatChainName(chain: SupportedChain): string {
  return CHAIN_DISPLAY_NAMES[chain] ?? chain;
}
