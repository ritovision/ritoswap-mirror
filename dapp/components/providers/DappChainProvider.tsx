// components/providers/DappChainProvider.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { getTargetChainId } from "@config/chain";

interface DappChainContextValue {
  /** The chain ID currently being viewed in the dapp (for balance display, etc.) */
  dappChainId: number;
  /** Set the dapp chain to a specific chain ID */
  setDappChainId: (chainId: number) => void;
  /** Reset the dapp chain back to the active/contract chain */
  resetToActiveChain: () => void;
  /** Whether the dapp is currently viewing the active chain */
  isOnActiveChain: boolean;
}

const DappChainContext = createContext<DappChainContextValue | null>(null);

interface DappChainProviderProps {
  children: ReactNode;
}

export function DappChainProvider({ children }: DappChainProviderProps) {
  const activeChainId = getTargetChainId();
  const { isConnected, chainId: walletChainId } = useAccount();
  const { switchChain } = useSwitchChain();

  // Dapp chain state - starts at active chain
  const [dappChainId, setDappChainIdState] = useState<number>(activeChainId);

  // Track if we've already attempted a switch for this connection
  const hasSwitchedRef = useRef(false);

  // Reset to active chain when wallet connects and switch wallet if needed
  useEffect(() => {
    if (isConnected) {
      setDappChainIdState(activeChainId);

      // Switch wallet to active chain if it's on a different chain
      if (walletChainId !== activeChainId && !hasSwitchedRef.current) {
        hasSwitchedRef.current = true;
        switchChain({ chainId: activeChainId });
      }
    } else {
      // Reset the switch flag when disconnected
      hasSwitchedRef.current = false;
    }
  }, [isConnected, activeChainId, walletChainId, switchChain]);

  const setDappChainId = useCallback((chainId: number) => {
    setDappChainIdState(chainId);
  }, []);

  const resetToActiveChain = useCallback(() => {
    setDappChainIdState(activeChainId);
  }, [activeChainId]);

  const isOnActiveChain = dappChainId === activeChainId;

  const value = useMemo<DappChainContextValue>(
    () => ({
      dappChainId,
      setDappChainId,
      resetToActiveChain,
      isOnActiveChain,
    }),
    [dappChainId, setDappChainId, resetToActiveChain, isOnActiveChain]
  );

  return (
    <DappChainContext.Provider value={value}>
      {children}
    </DappChainContext.Provider>
  );
}

export function useDappChain(): DappChainContextValue {
  const context = useContext(DappChainContext);
  if (!context) {
    throw new Error("useDappChain must be used within a DappChainProvider");
  }
  return context;
}
