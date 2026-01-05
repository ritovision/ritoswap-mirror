// app/mint/components/TokenStatus/TokenStatus.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./TokenStatus.module.css";
import { useAccount } from "wagmi";
import { useNFTStore } from "@store/nftStore";

/**
 * Hydration-safe TokenStatus:
 * - Always renders a neutral placeholder during SSR and before client mount.
 * - After mount, switches to the real wallet-dependent text (with the existing fade logic).
 * - This removes React's "Text content did not match" hydration warning.
 */
export default function TokenStatus() {
  const { isConnected } = useAccount();
  const { hasNFT, hasUsedTokenGate, isLoading } = useNFTStore();

  /** Mount gate so SSR and first client paint render identical content. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const getText = () => {
    if (!isConnected) return "You are not signed in";
    if (hasNFT && hasUsedTokenGate) return "You have a used key...";
    if (hasNFT) return "You have an unused key!";
    return "You don't have a key yet";
  };

  const [displayText, setDisplayText] = useState<string>("Loading...");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

  const previousTextRef = useRef<string>("Loading...");
  const timeoutIdsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const addTimeout = (cb: () => void, delay = 0) => {
    const id = setTimeout(() => {
      cb();
      timeoutIdsRef.current.delete(id);
    }, delay);
    timeoutIdsRef.current.add(id);
    return id;
  };

  useEffect(() => {
    if (!mounted) return;
    if (isLoading) return;

    const initial = getText();
    previousTextRef.current = initial;
    setHasInitialLoad(true);
    setDisplayText(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, isLoading]);

  useEffect(() => {
    if (!mounted) return;

    if (!isConnected) {
      timeoutIdsRef.current.forEach(clearTimeout);
      timeoutIdsRef.current.clear();

      const text = "You are not signed in";
      previousTextRef.current = text;

      addTimeout(() => {
        setDisplayText(text);
        setIsTransitioning(false);
      }, 0);
    }
  }, [mounted, isConnected]);

  // Handle subsequent changes with the existing fade logic
  useEffect(() => {
    if (!mounted) return;

    const timeouts = timeoutIdsRef.current;

    timeouts.forEach((id) => clearTimeout(id));
    timeouts.clear();

    if (!hasInitialLoad) return;
    if (isLoading) return;

    const newText = getText();
    if (newText !== previousTextRef.current) {
      previousTextRef.current = newText;

      addTimeout(() => setIsTransitioning(true), 0);

      addTimeout(() => {
        setDisplayText(newText);
        addTimeout(() => setIsTransitioning(false), 50);
      }, 500);
    }

    return () => {
      timeouts.forEach((id) => clearTimeout(id));
      timeouts.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, isConnected, hasNFT, hasUsedTokenGate, isLoading, hasInitialLoad]);

  return (
    <div
      className={styles.container}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <h1
        className={`${styles.text} ${isTransitioning ? styles.transitioning : ""}`}
        suppressHydrationWarning
      >
        {mounted ? displayText : "Loading..."}
      </h1>
    </div>
  );
}
