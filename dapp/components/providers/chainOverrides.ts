// components/providers/chainOverrides.ts
// if logo or chain names need to be overridden, add them here
import { publicEnv } from '@config/public.env'

export interface ChainOverride {
  displayName?: string;
  walletKey?: string;
  /** If present, provider will return this URL instead of CDN */
  localLogoUrl?: string;
}

const LOCAL_CHAIN_ID = publicEnv.NEXT_PUBLIC_LOCAL_CHAIN_ID ?? 90999999;
const LOCAL_CHAIN_NAME = publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME;

export const CHAIN_OVERRIDES: Record<number, ChainOverride> = {
  10:    { displayName: "Optimism", walletKey: "optimism" },
  42161: { displayName: "Arbitrum", walletKey: "arbitrum" },
  43114: { displayName: "Avalanche", walletKey: "avalanchec" },

  // ←– your local chain override (from public.env.ts)
  [LOCAL_CHAIN_ID]: {
    displayName: LOCAL_CHAIN_NAME,
    walletKey: LOCAL_CHAIN_NAME.toLowerCase().replace(/\s+/g, ""),
    localLogoUrl: "/images/blockchainLogos/ritonet.png",
  },
};
