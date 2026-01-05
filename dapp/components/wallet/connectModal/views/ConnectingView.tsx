// components/utilities/wallet/connectModal/views/ConnectingView.tsx
"use client";

import React from "react";
import styles from "../styles/ConnectingStates.module.css";

type WalletInfo = {
  name: string;
  icon?: string;
  isWalletConnect?: boolean;
} | null;

type Props = {
  wallet: WalletInfo;
  onCancel: () => void;
  onOpenWallet: () => void;
  onShowQr?: () => void;
  canOpenMobile: boolean;
  openWalletDisabled?: boolean;
};

export function ConnectingView({ wallet, onCancel, onOpenWallet, onShowQr, canOpenMobile, openWalletDisabled }: Props) {
  return (
    <div className={styles.loadingContent} role="region" aria-labelledby="connecting-status">
      {wallet?.icon && (
        <img
          src={wallet.icon}
          alt={`${wallet.name} logo`}
          className={styles.loadingIcon}
        />
      )}
      <p id="connecting-status" className={styles.loadingText} role="status" aria-live="polite">
        Connecting
      </p>
      <div className={styles.dotsContainer} aria-hidden="true">
        <span className={styles.dot1}>.</span>
        <span className={styles.dot2}>.</span>
        <span className={styles.dot3}>.</span>
      </div>
      <p className={styles.checkWalletText}>
        Please check your wallet to accept or reject connection
      </p>
      <div className={styles.actionButtons}>
        <button className={styles.cancelButton} onClick={onCancel} aria-label="Cancel wallet connection">
          Cancel
        </button>
        {canOpenMobile && onShowQr && (
          <button
            className={styles.showQrButton}
            onClick={onShowQr}
            disabled={openWalletDisabled}
            aria-label="Show QR code"
          >
            Show QR
          </button>
        )}
      </div>
      {canOpenMobile && (
        <div className={styles.openWalletRow}>
          <button
            className={styles.openWalletButton}
            onClick={onOpenWallet}
            disabled={openWalletDisabled}
            aria-label="Open wallet app"
          >
            Open Wallet
          </button>
        </div>
      )}
    </div>
  );
}
