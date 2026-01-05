// app/config/chain.ts
import { publicEnv } from './public.env';

// Chain types (lowercase normalized)
export type ChainType = 'ethereum' | 'sepolia' | 'ritonet';

// Runtime chain constants for casing flexibility and backward compatibility
export const Chain = {
  ETHEREUM: 'ethereum',
  SEPOLIA: 'sepolia',
  RITONET: 'ritonet',
} as const;

// Chain IDs (lowercase keys)
export const CHAIN_IDS = {
  ethereum: 1,
  sepolia: 11155111,
  ritonet: publicEnv.NEXT_PUBLIC_LOCAL_CHAIN_ID || 90999999,
} as const;

// Get the active chain from environment
export function getActiveChain(): ChainType {
  return publicEnv.NEXT_PUBLIC_ACTIVE_CHAIN;
}

// Get the target chain ID based on active chain
export function getTargetChainId(): number {
  return CHAIN_IDS[getActiveChain()];
}

// Get chain name for display (title case)
export function getChainDisplayName(chain: ChainType = getActiveChain()): string {
  return chain.charAt(0).toUpperCase() + chain.slice(1);
}

// Helper to check if we're on a specific chain
export function isActiveChain(chain: ChainType): boolean {
  return getActiveChain() === chain;
}

// Get chain-specific config with RPC endpoints
export function getChainConfig(chain: ChainType = getActiveChain()) {
  const alchemyKey = publicEnv.NEXT_PUBLIC_ALCHEMY_API_KEY;
  
  switch (chain) {
    case 'ritonet': {
      if (!publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_RPC || !publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_WSS) {
        throw new Error('Ritonet configuration incomplete');
      }
      return {
        chainId: CHAIN_IDS.ritonet,
        name: publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME,
        rpcUrl: publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_RPC,
        wssUrl: publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_WSS,
        explorerUrl: publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_EXPLORER_URL || undefined,
        explorerName: publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_EXPLORER_NAME,
        isTestnet: true,
      };
    }
      
    case 'sepolia': {
      return {
        chainId: CHAIN_IDS.sepolia,
        name: 'Sepolia',
        rpcUrl: alchemyKey 
          ? `https://eth-sepolia.g.alchemy.com/v2/${alchemyKey}`
          : 'https://rpc.sepolia.org',
        wssUrl: alchemyKey
          ? `wss://eth-sepolia.g.alchemy.com/v2/${alchemyKey}`
          : undefined,
        explorerUrl: 'https://sepolia.etherscan.io',
        explorerName: 'Sepolia Etherscan',
        isTestnet: true,
      };
    }
      
    case 'ethereum': {
      return {
        chainId: CHAIN_IDS.ethereum,
        name: 'Ethereum',
        rpcUrl: alchemyKey
          ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`
          : 'https://cloudflare-eth.com',
        wssUrl: alchemyKey
          ? `wss://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`
          : undefined,
        explorerUrl: 'https://etherscan.io',
        explorerName: 'Etherscan',
        isTestnet: false,
      };
    }
      
    default: {
      // Wrap in a block to satisfy no-case-declarations
      const _exhaustive: never = chain;
      throw new Error(`Unknown chain: ${_exhaustive}`);
    }
  }
}

// Get all supported chains
export function getSupportedChains(): ChainType[] {
  return ['ethereum', 'sepolia', 'ritonet'];
}

// Check if a chain is a testnet
export function isTestnet(chain: ChainType = getActiveChain()): boolean {
  return chain === 'sepolia' || chain === 'ritonet';
}

/* ============================================================
 * Convenience wrappers (moved from app/utils/chainConfig.ts)
 * ============================================================
 */

// Alias for consistency with previous usage
export function getTargetChainName(): string {
  return getChainDisplayName();
}

// Get chain ID by chain type
export function getChainIdByType(chainType: ChainType): number {
  return CHAIN_IDS[chainType];
}

// Current active chain config
export function getCurrentChainConfig() {
  return getChainConfig(getActiveChain());
}

// Is the current active chain a testnet?
export function isCurrentChainTestnet(): boolean {
  return isTestnet(getActiveChain());
}

// Get RPC URL (for a specific chain or current active)
export function getChainRpcUrl(chainType?: ChainType): string {
  const config = chainType ? getChainConfig(chainType) : getCurrentChainConfig();
  return config.rpcUrl;
}

// Get block explorer URL (for a specific chain or current active)
export function getChainExplorerUrl(chainType?: ChainType): string | undefined {
  const config = chainType ? getChainConfig(chainType) : getCurrentChainConfig();
  return config.explorerUrl;
}
