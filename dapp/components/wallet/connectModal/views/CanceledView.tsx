// components/utilities/wallet/connectModal/views/CanceledView.tsx
"use client";

import React from "react";
import styles from "../styles/ConnectingStates.module.css";

type WalletInfo = {
  name: string;
  icon?: string;
  isWalletConnect?: boolean;
} | null;

export function CanceledView({ wallet }: { wallet: WalletInfo }) {
  return (
    <div className={styles.loadingContent} role="alert">
      {wallet?.icon && (
        <img
          src={wallet.icon}
          alt={`${wallet.name} logo`}
          className={styles.loadingIcon}
        />
      )}
      <p className={styles.canceledText}>Connection canceled by user</p>
    </div>
  );
}
