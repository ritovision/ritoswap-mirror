// components/utilities/wallet/connectModal/views/ErrorView.tsx
"use client";

import React from "react";
import styles from "../styles/ConnectingStates.module.css";

type WalletInfo = {
  name: string;
  icon?: string;
  isWalletConnect?: boolean;
} | null;

export function ErrorView({ wallet }: { wallet: WalletInfo }) {
  return (
    <div className={styles.loadingContent} role="alert">
      {wallet?.icon && (
        <img
          src={wallet.icon}
          alt={`${wallet.name} logo`}
          className={styles.loadingIcon}
        />
      )}
      <p className={styles.errorText}>Connection Unsuccessful</p>
      <span className="sr-only">Wallet connection failed. Please try again.</span>
    </div>
  );
}
