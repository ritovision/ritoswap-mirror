// dapp/app/lib/mcp/utils/chains.ts
import { publicEnv } from '@config/public.env';
import { getChainConfig, type ChainType } from '@config/chain';

// Single source of truth for chain names/types and display names
import {
  type SupportedChain,
  formatChainName as formatChainNameBase,
} from '@schemas/domain/chains';

/**
 * Local alias typed as the canonical SupportedChain so TS knows this literal is valid.
 * Using a typed constant is safer than comparing against a raw string literal.
 */
const RITONET: SupportedChain = 'ritonet';

export const CHAIN_IDS: Record<SupportedChain, number> = {
  mainnet: 1,
  sepolia: 11155111,
  polygon: 137,
  arbitrum: 42161,
  avalanche: 43114,
  base: 8453,
  optimism: 10,
  fantom: 250,
  // ensure this value is numeric so the Record<..., number> type holds
  ritonet: Number(publicEnv.NEXT_PUBLIC_LOCAL_CHAIN_ID) || 90999999,
} as const;

/**
 * Get RPC URL for a chain.
 * - Local-only chains (ritonet) handled first.
 * - Public chains use Alchemy and are represented in alchemyNetworks.
 */
export function getRpcUrl(chain: SupportedChain): string {
  // Local network: use local chain config
  if (chain === RITONET) {
    const config = getChainConfig('ritonet' as ChainType);
    return config.rpcUrl;
  }

  // Alchemy key must exist for public chains
  const alchemyKey = publicEnv.NEXT_PUBLIC_ALCHEMY_API_KEY;
  if (!alchemyKey) {
    throw new Error('Alchemy API key not configured for public chains');
  }

  // We use Partial here because ritonet is intentionally not present in this mapping.
  const alchemyNetworks: Partial<Record<SupportedChain, string>> = {
    mainnet: 'eth-mainnet',
    sepolia: 'eth-sepolia',
    polygon: 'polygon-mainnet',
    arbitrum: 'arb-mainnet',
    avalanche: 'avax-mainnet',
    base: 'base-mainnet',
    optimism: 'opt-mainnet',
    fantom: 'fantom-mainnet',
    // ritonet intentionally omitted (local-only)
  };

  const network = alchemyNetworks[chain];
  if (!network) {
    throw new Error(`Unsupported chain for Alchemy RPC or local-only chain: ${chain}`);
  }

  return `https://${network}.g.alchemy.com/v2/${alchemyKey}`;
}

export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Format chain name for display. Use env override for local chain if present.
 */
export function formatChainName(chain: SupportedChain): string {
  if (chain === RITONET && publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME) {
    return publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME;
  }
  return formatChainNameBase(chain);
}
