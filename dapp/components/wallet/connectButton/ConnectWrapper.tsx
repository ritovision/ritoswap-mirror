// components/utilities/wallet/connectButton/ConnectWrapper.tsx
"use client";
import React, { useEffect, useState } from "react";
import { useAccount, useConnect } from "wagmi";
import ConnectState from "./ConnectState";
import styles from "./ConnectWrapper.module.css";

interface ConnectWrapperProps {
  variant?: "topnav" | "bottomnav" | "no-nav";
}

export default function ConnectWrapper({
  variant = "no-nav",
}: ConnectWrapperProps) {
  const { isConnected } = useAccount();
  const { isPending: isConnecting } = useConnect();
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    // small delay so wagmi checks localStorage first
    const timer = setTimeout(() => {
      if (!isConnected && !isConnecting) {
        setShowButton(true);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [isConnected, isConnecting]);

  useEffect(() => {
    if (isConnected || isConnecting) {
      setShowButton(false);
    }
  }, [isConnected, isConnecting]);

  if (!showButton) return null;

  return (
    <div 
      className={`${styles.wrapper} ${variant}`}
      role="region"
      aria-label="Wallet connection"
      aria-live="polite"
      aria-atomic="true"
    >
      <div role="status" className="sr-only">
        {isConnecting ? "Connecting to wallet..." : "Wallet not connected. Please connect your wallet to continue."}
      </div>
      <ConnectState />
    </div>
  );
}
