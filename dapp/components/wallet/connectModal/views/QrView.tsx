"use client";

import React from "react";
import styles from "../styles/QrView.module.css";
import QRCode from "react-qr-code";

type Props = {
  qrUri: string;
  copied: boolean;
  onBack: () => void;
  onCopy: () => void;
};

export function QrView({ qrUri, copied, onBack, onCopy }: Props) {
  const ready = Boolean(qrUri);

  return (
    <div className={styles.qrContent} role="region" aria-labelledby="qr-title">
      <button className={styles.backButton} onClick={onBack} aria-label="Go back to wallet selection">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <h2 id="qr-title" className={styles.qrTitle}>Scan with Phone&apos;s Wallet</h2>

      <div className={styles.qrContainer}>
        <div className={`${styles.qrWrapper} ${ready ? styles.isReady : ""}`}>
          <div className={styles.placeholderLayer} role="status" aria-live="polite">
            Generating QR Code...
          </div>

          {ready && (
            <div className={styles.qrLayer} role="img" aria-label="QR code for wallet connection">
              <div className={styles.qrCodeContainer}>
                <QRCode
                  value={qrUri}
                  size={198}
                  bgColor="#000000"
                  fgColor="var(--accent-color)"
                  level="M"
                  style={{ width: "100%", height: "100%" }}
                />
                <div className={styles.qrLogoContainer}>
                  <img
                    src="/images/blockchainLogos/ritonet.png"
                    alt="Logo"
                    className={styles.qrLogo}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        className={styles.copyButton}
        onClick={onCopy}
        disabled={!ready}
        aria-label={copied ? "Copied to clipboard" : "Copy connection link to clipboard"}
      >
        <svg className={styles.copyIcon} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
        <span>{copied ? "Copied!" : "Copy to Clipboard"}</span>
      </button>
    </div>
  );
}
