// components/utilities/wallet/network/NetworkWidget.tsx
"use client";

import React, { useEffect, useState } from "react";
import styles from "./NetworkWidget.module.css";
import { useAccount, useBalance, useConfig } from "wagmi";
import { formatUnits } from "viem";
import { useChainInfo } from "@/components/providers/ChainInfoProvider";
import { useDappChain } from "@/components/providers/DappChainProvider";
import NetworkModal from "./NetworkModal";

const NATIVE_TOKENS: { [chainId: number]: string } = {
  1: "ETH",
  137: "MATIC",
  42161: "ETH",
};

interface NetworkWidgetProps {
  variant?: "topnav" | "bottomnav" | "no-nav";
}

export default function NetworkWidget({
  variant = "no-nav",
}: NetworkWidgetProps) {
  const { address, isConnected } = useAccount();
  const { dappChainId } = useDappChain();
  const { chains } = useConfig();
  const dappChain = chains.find((c) => c.id === dappChainId);
  const { getChainLogoUrl, getFallbackLogoUrl } = useChainInfo();
  const { data: balance, isLoading } = useBalance({
    address: address as `0x${string}`,
    chainId: dappChainId,
  });

  const [showComponent, setShowComponent] = useState<boolean>(
    variant === "no-nav"
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // fade-in on connect (for non-no-nav)
  useEffect(() => {
    if (variant === "no-nav") return;
    const timer = setTimeout(() => {
      if (isConnected) setShowComponent(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [isConnected, variant]);

  // fade-out on disconnect
  useEffect(() => {
    if (variant !== "no-nav" && !isConnected) {
      const timer = setTimeout(() => setShowComponent(false), 0);
      return () => clearTimeout(timer);
    }
  }, [isConnected, variant]);

  // track opacity for CSS
  useEffect(() => {
    setTimeout(() => setIsLeaving(!isConnected), 0);
  }, [isConnected]);

  if (!showComponent) return null;

  // build the inner display
  let widgetInner;
  if (!isConnected || !dappChain) {
    const fb = getFallbackLogoUrl();
    widgetInner = (
      <>
        <svg
          className={styles.dropdownIcon}
          viewBox="0 0 10 6"
          width="10"
          height="6"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon points="0,0 10,0 5,6" fill="white" />
        </svg>
        <img src={fb} alt="Unknown network" className={styles.logo} />
        <span className={styles.symbol}>???</span>
        <span className={styles.balance}>unknown</span>
      </>
    );
  } else {
    let display: string;
    if (isLoading) {
      display = "...";
    } else if (balance) {
      const raw = parseFloat(
        formatUnits(balance.value, balance.decimals)
      );
      const intLen = Math.floor(raw).toString().length;
      const fracDigits = Math.max(0, 6 - intLen);
      display = raw.toFixed(fracDigits);
    } else {
      display = "0.000000";
    }

    const symbol =
      NATIVE_TOKENS[dappChainId] ?? dappChain.nativeCurrency.symbol;
    const logoUrl = getChainLogoUrl(dappChainId);
    const fallback = getFallbackLogoUrl();

    widgetInner = (
      <>
        <svg
          className={styles.dropdownIcon}
          viewBox="0 0 10 6"
          width="10"
          height="6"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon points="0,0 10,0 5,6" fill="white" />
        </svg>
        <img
          src={logoUrl}
          alt={`${symbol} logo`}
          className={styles.logo}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = fallback;
          }}
        />
        <span className={styles.symbol}>{symbol}</span>
        <span className={styles.balance}>{display}</span>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.wrapper} ${variant}`}
        onClick={() => setIsModalOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isModalOpen}
        style={{ opacity: isLeaving ? 0 : 1 }}
      >
        <div className={styles.container}>{widgetInner}</div>
      </button>

      <NetworkModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
