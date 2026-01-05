// components/utilities/wallet/connectButton/ConnectState.tsx
'use client';

import React from 'react';
import styles from './ConnectWrapper.module.css';
import { openWalletConnectModal } from '@/components/wallet/connectModal/connectModalBridge';

export default function ConnectState() {
  return (
    <>
      <button onClick={openWalletConnectModal} className={styles.button}>
        <span className={styles.iconWrapper}>
          {/* plug with a squiggly tail emerging from its left-center */}
          <svg
            className={styles.plug}
            viewBox="0 0 36 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* squiggly tail */}
            <path d="M16 12 C10 12 10 20 4 20 C2 20 2 18 1 19" />
            {/* plug body */}
            <rect x="16" y="7" width="8" height="10" rx="1" />
            {/* prongs */}
            <line x1="24" y1="9" x2="32" y2="9" />
            <line x1="24" y1="15" x2="32" y2="15" />
          </svg>

          {/* wallet icon */}
          <svg
            className={styles.wallet}
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M2 11h20" />
          </svg>
        </span>
        <span className={styles.text}>Connect Wallet</span>
      </button>
    </>
  );
}
