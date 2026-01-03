"use client";

import React from "react";
import Link from "next/link";
import { Connector } from "wagmi";
import wrapper from "../styles/ModalWrapper.module.css";
import list from "../styles/WalletList.module.css";
import logo from "../styles/Logo.module.css";
import { WalletButton } from "../components/WalletButton";

type Props = {
  connectors: Connector[];
  onSelect: (c: Connector) => void;
  onGetWallet: () => void;
  onClose: () => void;
};

type ConnectorWithOptionalIcon = Connector & { icon?: unknown };
function getConnectorIcon(connector: Connector): string | undefined {
  const icon = (connector as unknown as ConnectorWithOptionalIcon).icon;
  return typeof icon === "string" ? icon : undefined;
}

export function DefaultView({ connectors, onSelect, onGetWallet, onClose }: Props) {
  return (
    <>
      <div className={wrapper.modalContent} role="region" aria-labelledby="modal-title">
        <div className={logo.logoWrapper}>
          <img src="/images/brand/ritoswap.png" alt="RitoSwap Logo" className={logo.logo} />
        </div>
        <div className={wrapper.header}>
          <h2 id="modal-title" className={wrapper.title}>Connect Your Wallet</h2>
          <button className={wrapper.closeButton} onClick={onClose} aria-label="Close wallet connection modal">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={list.walletsContainer} role="list" aria-label="Available wallets">
          {connectors.map((connector) => {
            const isWalletConnect = connector.type === "walletConnect";
            const icon = isWalletConnect ? "/images/wallets/walletconnect.png" : getConnectorIcon(connector);
            const name = connector.name;
            return (
              <WalletButton
                key={connector.id}
                icon={icon}
                name={name}
                onClick={() => onSelect(connector)}
              />
            );
          })}
        </div>

        <button
          className={list.noWalletButton}
          onClick={onGetWallet}
          aria-label="Learn about wallets and how to get one"
        >
          I don&apos;t have a wallet yet
        </button>
      </div>

      <div className={wrapper.termsSection}>
        <p className={wrapper.termsText}>
          By connecting your wallet you agree to the{" "}
          <Link href="/terms" className={wrapper.termsLink}>
            <strong>Terms of Service</strong>
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className={wrapper.termsLink}>
            <strong>Privacy Policy</strong>
          </Link>
        </p>
      </div>
    </>
  );
}
