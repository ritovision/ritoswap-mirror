// File: components/providers/ChainInfoProvider.tsx
"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
} from "react";
import { useAccount, useConfig } from "wagmi";
import type { Chain } from "viem";
import { CHAIN_OVERRIDES, ChainOverride } from "./chainOverrides";

const FALLBACK_LOGO =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">' +
  '<circle cx="10" cy="10" r="10" fill="%2304426C"/>' +
  '<text x="10" y="11" text-anchor="middle" dominant-baseline="middle" ' +
  'fill="white" font-size="16" font-family="Arial%2C%20sans-serif">?</text>' +
  '</svg>';

interface ChainInfoContextType {
  activeChain?: Chain;
  getCurrentChainLogoUrl: () => string;
  getChainLogoUrl: (chainId: number) => string;
  getTokenLogoUrl: (chainId: number, tokenAddress: string) => string;
  getFallbackLogoUrl: () => string;
  getChainDisplayName: (chainId: number) => string;
  getCurrentChainDisplayName: () => string;
}

const ChainInfoContext = createContext<ChainInfoContextType>({
  activeChain: undefined,
  getCurrentChainLogoUrl: () => FALLBACK_LOGO,
  getChainLogoUrl: () => FALLBACK_LOGO,
  getTokenLogoUrl: () => FALLBACK_LOGO,
  getFallbackLogoUrl: () => FALLBACK_LOGO,
  getChainDisplayName: () => "Unknown",
  getCurrentChainDisplayName: () => "Unknown",
});

export function ChainInfoProvider({ children }: { children: ReactNode }) {
  const { chain: activeChain } = useAccount();
  const { chains: configChains } = useConfig();

  const normalizeKey = (name: string) =>
    name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

  const lookupOverride = (chainId: number): ChainOverride =>
    CHAIN_OVERRIDES[chainId] || {};

  const getChainDisplayName = (chainId: number): string => {
    const override = lookupOverride(chainId);
    if (override.displayName) return override.displayName;
    const target =
      configChains.find((c) => c.id === chainId) ?? activeChain;
    return target?.name ?? "Unknown";
  };

  const getCurrentChainDisplayName = (): string =>
    activeChain ? getChainDisplayName(activeChain.id) : "Unknown";

  const getChainLogoUrl = (chainId: number): string => {
    const target =
      configChains.find((c) => c.id === chainId) ?? activeChain;
    if (!target) return FALLBACK_LOGO;

    const override = lookupOverride(chainId);
    if (override.localLogoUrl) {
      return override.localLogoUrl;
    }

    const key = override.walletKey ?? normalizeKey(target.name);
    return `https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/${key}/info/logo.png`;
  };

  const getCurrentChainLogoUrl = (): string =>
    activeChain ? getChainLogoUrl(activeChain.id) : FALLBACK_LOGO;

  const getTokenLogoUrl = (
    chainId: number,
    tokenAddress: string
  ): string => {
    const target =
      configChains.find((c) => c.id === chainId) ?? activeChain;
    if (!target || !tokenAddress) return FALLBACK_LOGO;

    const override = lookupOverride(chainId);
    if (override.localLogoUrl) {
      return override.localLogoUrl;
    }

    const key = override.walletKey ?? normalizeKey(target.name);
    const addr = tokenAddress.toLowerCase();
    return `https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/${key}/assets/${addr}/logo.png`;
  };

  const getFallbackLogoUrl = () => FALLBACK_LOGO;

  return (
    <ChainInfoContext.Provider
      value={{
        activeChain,
        getCurrentChainLogoUrl,
        getChainLogoUrl,
        getTokenLogoUrl,
        getFallbackLogoUrl,
        getChainDisplayName,
        getCurrentChainDisplayName,
      }}
    >
      {children}
    </ChainInfoContext.Provider>
  );
}

export function useChainInfo(): ChainInfoContextType {
  return useContext(ChainInfoContext);
}
