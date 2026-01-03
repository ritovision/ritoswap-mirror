// components/utilities/wallet/accountModal/AccountModal.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  useAccount,
  useDisconnect,
  useEnsName,
  useEnsAvatar,
  useBalance,
  useConfig,
} from "wagmi";
import { formatUnits } from "viem";
import { useChainInfo } from "@/components/providers/ChainInfoProvider";
import { useDappChain } from "@/components/providers/DappChainProvider";
import NetworkModal from "../network/NetworkModal";
import { useSwipeable } from "react-swipeable";
import styles from "./AccountModal.module.css";

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AccountItemProps {
  address: string;
  isActive: boolean;
  onClick: () => void;
  chainId: number;
}

const NATIVE_TOKENS: { [chainId: number]: string } = {
  1: "ETH",
  137: "MATIC",
  42161: "ETH",
};

/**
 * Renders a single account entry with balance and optional ENS data.
 */
function AccountItem({ address, isActive, onClick, chainId }: AccountItemProps) {
  const { data: ensName } = useEnsName({
    address: address as `0x${string}`,
    chainId: 1,
  });
  const { data: ensAvatar } = useEnsAvatar({
    name: ensName ?? undefined,
    chainId: 1,
  });
  const { data: balance, isLoading } = useBalance({
    address: address as `0x${string}`,
    chainId,
  });

  // Format balance display
  let balanceDisplay: string;
  if (isLoading) {
    balanceDisplay = "...";
  } else if (balance) {
    const raw = parseFloat(formatUnits(balance.value, balance.decimals));
    const intLen = Math.floor(raw).toString().length;
    const fracDigits = Math.max(0, 6 - intLen);
    balanceDisplay = raw.toFixed(fracDigits);
  } else {
    balanceDisplay = "0.000000";
  }

  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  const truncateEns = (ens: string) => {
    if (ens.length <= 15) return ens;
    const base = ens.slice(0, -4);
    return `${base.slice(0, 11)}…eth`;
  };

  const displayName = ensName ? truncateEns(ensName) : truncateAddress(address);
  const fullAddress = address;
  const balanceText = isLoading ? "Loading balance" : `${balanceDisplay} ${balance?.symbol || 'ETH'}`;

  return (
    <button
      onClick={onClick}
      className={`${styles.accountButton} ${
        isActive ? styles.active : ""
      }`}
      aria-label={`Account ${displayName}, balance: ${balanceText}${isActive ? ', currently active' : ''}`}
      role="radio"
      aria-checked={isActive}
    >
      <span className={styles.balance} aria-hidden="true">{balanceDisplay}</span>
      <div className={styles.divider} aria-hidden="true" />
      <div className={styles.accountContent}>
        {ensAvatar ? (
          <Image
            src={ensAvatar}
            alt=""
            role="presentation"
            width={24}
            height={24}
            className={styles.ensAvatar}
            unoptimized
          />
        ) : ensName ? (
          <div className={styles.ensAvatarPlaceholder} aria-hidden="true" />
        ) : null}
        <span className={styles.accountAddress} title={fullAddress}>
          {displayName}
        </span>
      </div>
    </button>
  );
}

/**
 * Modal displaying all connected accounts with balances and network switch.
 */
export default function AccountModal({
  isOpen,
  onClose,
}: AccountModalProps) {
  const { address: activeAddress, addresses = [] } = useAccount();
  const { disconnect } = useDisconnect();
  const { dappChainId } = useDappChain();
  const { chains } = useConfig();
  const dappChain = chains.find((c) => c.id === dappChainId);
  const {
    getChainLogoUrl,
    getFallbackLogoUrl,
    getChainDisplayName,
  } = useChainInfo();
  const modalRef = useRef<HTMLDivElement>(null);
  const [showNetworkModal, setShowNetworkModal] = useState(false);

  // Focus management
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      if (firstElement) {
        firstElement.focus();
      }
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen || showNetworkModal) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, showNetworkModal]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen || showNetworkModal) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () =>
      document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose, showNetworkModal]);

  // Swipe-to-close handlers
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => onClose(),
    preventScrollOnSwipe: true,
    trackTouch: true,
    trackMouse: false,
    delta: { left: 50 },
    swipeDuration: 300,
  });

  if (!isOpen) return null;

  // Ensure active account is first
  const sorted = [...addresses].sort((a, b) => {
    const al = a.toLowerCase();
    const bl = b.toLowerCase();
    const act = activeAddress?.toLowerCase() || "";
    if (al === act) return -1;
    if (bl === act) return 1;
    return 0;
  });
  const displayAddresses =
    sorted.length > 0 ? sorted : activeAddress ? [activeAddress] : [];

  const nativeSymbol =
    NATIVE_TOKENS[dappChainId] ?? dappChain?.nativeCurrency.symbol ?? "ETH";
  const chainName = getChainDisplayName(dappChainId);
  const chainLogo = getChainLogoUrl(dappChainId);

  return (
    <>
      <div
        className={styles.overlay}
        onClick={() => {
          if (!showNetworkModal) onClose();
        }}
        aria-hidden="true"
      />
      <div className={styles.modalContainer} {...swipeHandlers}>
        <div 
          className={styles.modal} 
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-modal-title"
          aria-describedby={displayAddresses.length > 1 ? "account-note" : "single-account-note"}
        >
          <div className={styles.header}>
            <h2 id="account-modal-title" className={styles.title}>Connected Accounts</h2>
            <button
              onClick={onClose}
              className={styles.closeButton}
              aria-label="Close modal"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M15 5L5 15M5 5L15 15"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <div className={styles.accountListWrapper}>
            <div 
              className={styles.accountList}
              role="radiogroup"
              aria-label="Connected wallet accounts"
            >
              {displayAddresses.map((addr) => (
                <AccountItem
                  key={addr}
                  address={addr}
                  isActive={
                    addr.toLowerCase() ===
                    activeAddress?.toLowerCase()
                  }
                  chainId={dappChainId}
                  onClick={() => {
                    /* no-op */
                  }}
                />
              ))}
            </div>
          </div>

          {displayAddresses.length > 1 ? (
            <div id="account-note" className={styles.accountNote} role="status">
              For security, to switch your "active" account, you must do
              so in your wallet directly.
            </div>
          ) : (
            <div id="single-account-note" className={styles.singleAccountNote} role="status">
              Only one account connected.
            </div>
          )}

          <div className={styles.actions} role="group" aria-label="Modal actions">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowNetworkModal(true);
              }}
              className={styles.networkButton}
              aria-label={`Switch network. Currently on ${chainName} with ${nativeSymbol}`}
            >
              <img
                src={chainLogo}
                alt=""
                role="presentation"
                className={styles.chainLogo}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = getFallbackLogoUrl();
                }}
              />
              <span aria-hidden="true">
                {chainName} · {nativeSymbol}
              </span>
            </button>

            <button
              onClick={() => {
                disconnect();
                onClose();
              }}
              className={styles.disconnectButton}
              aria-label="Disconnect wallet"
            >
              <span>Disconnect</span>
              <svg
                viewBox="0 0 36 24"
                fill="none"
                className={styles.disconnectIcon}
                aria-hidden="true"
              >
                <path
                  d="M18 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H18"
                  stroke="white"
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
          </div>
        </div>
      </div>

      <NetworkModal
        isOpen={showNetworkModal}
        onClose={() => setShowNetworkModal(false)}
      />
    </>
  );
}
