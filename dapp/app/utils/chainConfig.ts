// app/utils/chainConfig.ts
import { 
  getActiveChain, 
  getTargetChainId, 
  getChainDisplayName, 
  isActiveChain, 
  CHAIN_IDS, 
  Chain,
  getChainConfig,
  getSupportedChains,
  isTestnet,
  type ChainType as ChainTypeFromConfig
} from '@config/chain';

// Re-export all chain functionality from the central config
export { 
  getActiveChain, 
  getTargetChainId, 
  isActiveChain,
  CHAIN_IDS,
  Chain,
  getChainConfig,
  getSupportedChains,
  isTestnet
};

// Export ChainType for backward compatibility (uppercase keys)
export const ChainType = Chain;

// Export chain type for backward compatibility
export type ChainType = ChainTypeFromConfig;

// Get chain name for display (alias for consistency)
export function getTargetChainName(): string {
  return getChainDisplayName();
}

// Get chain ID by chain type (convenience function)
export function getChainIdByType(chainType: ChainType): number {
  return CHAIN_IDS[chainType];
}

// Additional convenience functions that leverage the source of truth
export function getCurrentChainConfig() {
  return getChainConfig(getActiveChain());
}

export function isCurrentChainTestnet(): boolean {
  return isTestnet(getActiveChain());
}

export function getChainRpcUrl(chainType?: ChainType): string {
  const config = chainType ? getChainConfig(chainType) : getCurrentChainConfig();
  return config.rpcUrl;
}

export function getChainExplorerUrl(chainType?: ChainType): string | undefined {
  const config = chainType ? getChainConfig(chainType) : getCurrentChainConfig();
  return config.explorerUrl;
}