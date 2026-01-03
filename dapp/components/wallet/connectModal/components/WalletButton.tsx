// components/utilities/wallet/connectModal/components/WalletButton.tsx
"use client";

import React from "react";
import styles from "../styles/WalletList.module.css";

type Props = {
  icon?: string | null;
  name: string;
  onClick: () => void;
};

export function WalletButton({ icon, name, onClick }: Props) {
  const fallbackIcon = "/images/wallets/metamask-logo.png";
  return (
    <button
      className={styles.walletButton}
      onClick={onClick}
      disabled={false}
      role="listitem"
      aria-label={`Connect with ${name}`}
    >
      <img
        src={icon || fallbackIcon}
        alt=""
        className={styles.walletIcon}
        onError={(e) => {
          e.currentTarget.src = fallbackIcon;
        }}
        aria-hidden="true"
      />
      <span className={styles.walletName}>{name}</span>
    </button>
  );
}
