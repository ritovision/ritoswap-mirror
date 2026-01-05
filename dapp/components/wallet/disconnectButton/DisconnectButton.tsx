"use client";
import React, { useEffect, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import styles from "./DisconnectButton.module.css";

interface DisconnectButtonProps {
  variant?: "topnav" | "bottomnav" | "no-nav";
}

export default function DisconnectButton({
  variant = "no-nav",
}: DisconnectButtonProps) {
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  
  // controls mount/unmount…
  const [showButton, setShowButton] = useState(false);
  // …and "leaving" opacity
  const [isLeaving, setIsLeaving] = useState(false);
  
  // show after small init delay
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isConnected) setShowButton(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [isConnected]);
  
  // on disconnect → transparent then unmount
  useEffect(() => {
    if (!isConnected) {
      setTimeout(() => setIsLeaving(true), 0);
      const timer = setTimeout(() => setShowButton(false), 0);
      return () => clearTimeout(timer);
    }
  }, [isConnected]);
  
  // on reconnect → clear leaving
  useEffect(() => {
    if (isConnected) {
      setTimeout(() => setIsLeaving(false), 0);
    }
  }, [isConnected]);
  
  if (!showButton) return null;
  
  return (
    <button
      onClick={() => disconnect()}
      className={`${styles.button} ${variant}`}
      aria-label="Disconnect wallet"
      style={{ opacity: isLeaving ? 0 : 1 }}
    >
      <svg viewBox="0 0 36 24" fill="none" className={styles.icon}>
        <path
          d="M18 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H18"
          stroke="var(--secondary-color)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="14"
          y1="12"
          x2="28"
          y2="12"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          className={styles.arrowLine}
        />
        <line
          x1="28"
          y1="12"
          x2="32"
          y2="12"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          className={styles.arrowExtension}
        />
        <polyline
          points="25 9 28 12 25 15"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={styles.arrowHead}
        />
      </svg>
    </button>
  );
}