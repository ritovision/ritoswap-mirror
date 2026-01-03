"use client";

import React, { useEffect, useState } from "react";
import type { ImageProps } from "next/image";
import dynamic from "next/dynamic";
import {
  useAccount,
  useEnsName,
  useEnsAvatar,
  useChainId,
} from "wagmi";
import AccountModal from "../accountModal/AccountModal";
import styles from "./AddressDisplay.module.css";

const Image = dynamic(
  () => import("next/image"),
  { ssr: false }
) as React.FC<ImageProps>;

interface AddressDisplayProps {
  variant?: "topnav" | "bottomnav" | "no-nav";
}

export default function AddressDisplay({
  variant = "no-nav",
}: AddressDisplayProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  // NEW: track "leaving" state for immediate transparency
  const [isLeaving, setIsLeaving] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showComponent, setShowComponent] = useState(false);
  const [hideAddress, setHideAddress] = useState(false);
  const [showEns, setShowEns] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);

  // Fetch ENS always from mainnet (chainId: 1)
  const { data: ensName } = useEnsName({
    address,
    chainId: 1,
  });
  const { data: ensAvatar } = useEnsAvatar({
    name: ensName || undefined,
    chainId: 1,
  });

  // 1) Show button once connected (immediate for "no-nav", delayed otherwise)
  useEffect(() => {
    if (!isConnected) return;

    if (variant === "no-nav") {
      setShowComponent(true);
      return;
    }

    const t = setTimeout(() => {
      setShowComponent(true);
    }, 100);
    return () => clearTimeout(t);
  }, [isConnected, variant]);

  // 2) On showComponent or address/chain/ENS change, reset & fade into ENS/avatar
  useEffect(() => {
    if (!showComponent) return;

    setTimeout(() => {
      setHideAddress(false);
      setShowEns(false);
      setShowAvatar(false);
    }, 0);

    let fadeInTimer: NodeJS.Timeout | undefined;
    let fadeOutTimer: NodeJS.Timeout | undefined;

    if (ensName) {
      fadeOutTimer = setTimeout(() => {
        setHideAddress(true);
        fadeInTimer = setTimeout(() => {
          setShowEns(true);
          setShowAvatar(true);
        }, 500);
      }, 2000);
    }

    // Cleanup both timers
    return () => {
      if (fadeOutTimer) clearTimeout(fadeOutTimer);
      if (fadeInTimer) clearTimeout(fadeInTimer);
    };
  }, [showComponent, address, chainId, ensName]);

  // 3a) On disconnect → immediately transparent, then unmount
  useEffect(() => {
    if (!isConnected) {
      setTimeout(() => {
        setIsLeaving(true);
        setHideAddress(false);
        setShowEns(false);
        setShowAvatar(false);
        setIsModalOpen(false);
      }, 0);

      const unmountTimer = setTimeout(() => setShowComponent(false), 0);
      
      // Cleanup the timeout
      return () => clearTimeout(unmountTimer);
    }
  }, [isConnected]);

  // 3b) On reconnect → clear leaving flag for normal appearance
  useEffect(() => {
    if (isConnected) {
      setTimeout(() => setIsLeaving(false), 0);
    }
  }, [isConnected]);

  if (!showComponent || !address) return null;

  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  const truncateEns = (ens: string) => {
    if (ens.length <= 15) return ens;
    if (ens.endsWith(".eth")) {
      const base = ens.slice(0, -4);
      return `${base.slice(0, 11)}…eth`;
    }

    const prefix = ens.slice(0, 11);
    const suffix = ens.slice(-4);
    return `${prefix}…${suffix}`;
  };

  const ariaLabel = ensName 
    ? `Wallet account: ${ensName} (${address}). Click to view account details`
    : `Wallet account: ${address}. Click to view account details`;

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`${styles.button} ${variant}`}
        aria-label={ariaLabel}
        style={{ opacity: isLeaving ? 0 : 1 }}
      >
        <div className={styles.content}>
          {ensName && (
            <div
              className={`${styles.avatarWrapper} ${
                showAvatar ? styles.showAvatar : ""
              }`}
            >
              {ensAvatar ? (
                <Image
                  src={ensAvatar}
                  alt=""
                  width={24}
                  height={24}
                  className={styles.avatar}
                  unoptimized
                  aria-hidden="true"
                />
              ) : (
                <div className={styles.avatarFallback} aria-hidden="true" />
              )}
            </div>
          )}
          <div className={styles.textWrapper}>
            <span
              className={`${styles.address} ${
                hideAddress ? styles.hideAddress : ""
              }`}
              aria-hidden={hideAddress}
            >
              {truncateAddress(address)}
            </span>
            {ensName && (
              <span
                className={`${styles.ens} ${
                  showEns ? styles.showEns : ""
                }`}
                aria-hidden={!showEns}
              >
                {truncateEns(ensName)}
              </span>
            )}
            <span className="sr-only">
              {ensName 
                ? `ENS name: ${ensName}, Address: ${address}`
                : `Wallet address: ${address}`
              }
            </span>
          </div>
        </div>
      </button>

      <AccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
