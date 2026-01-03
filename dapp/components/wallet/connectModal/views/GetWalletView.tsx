// components/utilities/wallet/connectModal/views/GetWalletView.tsx
"use client";

import React from "react";
import styles from "../styles/GetWalletView.module.css";

export function GetWalletView({ onBack }: { onBack: () => void }) {
  return (
    <div className={styles.getWalletContent} role="region" aria-labelledby="get-wallet-title">
      <button className={styles.backButton} onClick={onBack} aria-label="Go back to wallet selection">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <h2 id="get-wallet-title" className={styles.getWalletTitle}>What does a wallet do?</h2>

      <div className={styles.walletFeatures} role="list">
        <div className={styles.featureItem} role="listitem">
          <svg className={styles.checkIcon} viewBox="0 0 24 24" fill="none" stroke="var(--utility-green)" strokeWidth="2" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className={styles.featureText}>Holds your crypto and NFTs</span>
        </div>
        <div className={styles.featureItem} role="listitem">
          <svg className={styles.checkIcon} viewBox="0 0 24 24" fill="none" stroke="var(--utility-green)" strokeWidth="2" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className={styles.featureText}>Lets you send and receive crypto</span>
        </div>
        <div className={styles.featureItem} role="listitem">
          <svg className={styles.checkIcon} viewBox="0 0 24 24" fill="none" stroke="var(--utility-green)" strokeWidth="2" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className={styles.featureText}>Let&apos;s you sign in to dApps securely</span>
        </div>
        <div className={styles.featureItem} role="listitem">
          <svg className={styles.checkIcon} viewBox="0 0 24 24" fill="none" stroke="var(--utility-green)" strokeWidth="2" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className={styles.featureText}>Gives you an identity in the blockchain</span>
        </div>
      </div>

      <p className={styles.walletInfo}>
        You can get one as a standalone mobile app or a desktop browser extension.
        <br /><br />
        You need a wallet to interact with RitoSwap!
      </p>

      <a
        href="https://ethereum.org/en/wallets/find-wallet/"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.getWalletButton}
        aria-label="Get a wallet - opens in new tab"
      >
        Get a Wallet
      </a>
    </div>
  );
}
