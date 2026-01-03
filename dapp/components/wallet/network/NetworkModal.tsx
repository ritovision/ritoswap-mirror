// components/utilities/wallet/network/NetworkModal.tsx
"use client";

/**
 * NetworkModal.tsx
 *
 * Displays a network‐selection modal that can be dismissed
 * by:
 *   • tapping the backdrop
 *   • clicking ✕
 *   • swiping left
 *   • pressing Escape
 */

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useSwipeable } from "react-swipeable";
import styles from "./NetworkModal.module.css";
import { useAccount, useConfig } from "wagmi";
import { useChainInfo } from "@/components/providers/ChainInfoProvider";
import { useDappChain } from "@/components/providers/DappChainProvider";

interface NetworkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NetworkModal({
  isOpen,
  onClose,
}: NetworkModalProps) {
  const { isConnected } = useAccount();
  const { dappChainId, setDappChainId } = useDappChain();
  const { chains } = useConfig();
  const { getChainLogoUrl, getFallbackLogoUrl, getChainDisplayName } =
    useChainInfo();

  // ref for the close button
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // auto-close if they disconnect
  useEffect(() => {
    if (!isConnected && isOpen) onClose();
  }, [isConnected, isOpen, onClose]);

  // when modal opens, focus the close button
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  // close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // swipe-to-close handlers
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => onClose(),
    preventScrollOnSwipe: true,
    trackTouch: true,
    trackMouse: false,
    delta: { left: 50 },
    swipeDuration: 300,
  });

  if (!isOpen) return null;

  // ensure selected dapp chain is first
  const sortedChains = [...chains].sort((a, b) => {
    if (a.id === dappChainId) return -1;
    if (b.id === dappChainId) return 1;
    return 0;
  });

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />

      <div
        className={styles.modalWrapper}
        {...swipeHandlers}
        role="dialog"
        aria-modal="true"
        aria-labelledby="network-modal-title"
      >
        <div className={styles.modal}>
          {/* Header */}
          <div className={styles.topSection}>
            <h2 id="network-modal-title" className={styles.title}>
              Select a Network
            </h2>
            <button
              ref={closeButtonRef}
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close modal"
            >
              <svg
                className={styles.closeIcon}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {/* Chain list */}
          <div className={styles.middleSection}>
            <div className={styles.networksContainer} role="list">
              {sortedChains.map((chain) => {
                const isActive = chain.id === dappChainId;
                const logoUrl = getChainLogoUrl(chain.id);
                const name = getChainDisplayName(chain.id);

                return (
                  <button
                    key={chain.id}
                    role="listitem"
                    aria-current={isActive ? "true" : undefined}
                    className={`${styles.networkButton} ${
                      isActive ? styles.active : ""
                    }`}
                    onClick={() => {
                      setDappChainId(chain.id);
                      onClose();
                    }}
                  >
                    <img
                      src={logoUrl}
                      alt={`${name} logo`}
                      className={styles.chainLogo}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = getFallbackLogoUrl();
                      }}
                    />
                    <span className={styles.chainName}>{name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom gradient overlay */}
          <div className={styles.bottomSection} />
        </div>
      </div>
    </>,
    document.body
  );
}
