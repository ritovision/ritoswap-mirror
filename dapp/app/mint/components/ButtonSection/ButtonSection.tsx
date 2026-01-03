// app/mint/components/ButtonSection/ButtonSection.tsx
"use client"

import React, { useState, useEffect, useRef } from "react"
import styles from "./ButtonSection.module.css"
import { useAccount } from "wagmi"
import { useNFTStore } from "@store/nftStore"
import { useMintBurn } from "@hooks/useMintBurn"
import ConnectWrapper from "@/components/wallet/connectButton/ConnectWrapper"
import Link from "next/link"
import ProcessingModal from "@/components/wallet/processingModal/ProcessingModal"
import { Chain, isActiveChain } from "@config/chain"

type ButtonSectionProps = {
  /** Provided by MintPageWrapper; triggers a full NFT data refresh */
  onRefresh?: () => Promise<void> | void
}

export default function ButtonSection({ onRefresh }: ButtonSectionProps) {
  const { isConnected } = useAccount()

  const {
    hasNFT,
    hasUsedTokenGate,
    tokenId,
    setLoading,
    isLoading,
    isSwitchingAccount, // important to avoid UI flicker during account switch
  } = useNFTStore()

  // Centralized chain flag
  const isSepolia = isActiveChain(Chain.SEPOLIA)

  const [isHydrated, setIsHydrated] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [renderState, setRenderState] = useState<
    "loading" | "not-connected" | "no-nft" | "has-nft" | "used-gate"
  >("loading")

  // Block "Processing..." text until next button click
  const [blockProcessingText, setBlockProcessingText] = useState(false)

  // Use refs to track timeouts for proper cleanup
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fadeInTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const callRefresh = async () => {
    try {
      await onRefresh?.()
    } catch {
      /* no-op */
    }
  }

  // Success callbacks for mint and burn
  const handleMintSuccess = async () => {
    // Block processing text when state is about to change
    setBlockProcessingText(true)
    await callRefresh()
    setLoading(false)
  }

  const handleBurnSuccess = async () => {
    // Block processing text when state is about to change
    setBlockProcessingText(true)
    await callRefresh()
    setLoading(false)
  }

  // Blockchain interaction hook
  const { mint, burn, isProcessing, mintHash, burnHash, resetAll } = useMintBurn(
    { onMintSuccess: handleMintSuccess, onBurnSuccess: handleBurnSuccess }
  )

  // Hydration safety
  useEffect(() => {
    const t = setTimeout(() => setIsHydrated(true), 50)
    return () => clearTimeout(t)
  }, [])

  const handleMint = () => {
    setBlockProcessingText(false) // Allow processing text on button click
    setLoading(true)
    mint()
  }

  const handleBurn = () => {
    setBlockProcessingText(false) // Allow processing text on button click
    setLoading(true)
    burn(tokenId)
  }

  const handleModalCancel = async () => {
    resetAll()
    setLoading(false)
    setBlockProcessingText(true) // Block processing text on cancel
    await callRefresh()
  }

  // Clean up any pending transitions
  const clearTransitionTimeouts = () => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current)
      transitionTimeoutRef.current = null
    }
    if (fadeInTimeoutRef.current) {
      clearTimeout(fadeInTimeoutRef.current)
      fadeInTimeoutRef.current = null
    }
  }

  // Compute render state; during account switching we "freeze" UI instead of re-computing
  useEffect(() => {
    if (!isHydrated || isLoading) return
    if (isSwitchingAccount) return // keep current UI visible while switching

    let next: typeof renderState = "no-nft"
    if (!isConnected) next = "not-connected"
    else if (hasNFT && hasUsedTokenGate) next = "used-gate"
    else if (hasNFT) next = "has-nft"

    if (renderState === "loading") {
      setTimeout(() => setRenderState(next), 0)
      return
    }

    if (next !== renderState) {
      clearTransitionTimeouts()

      setTimeout(() => {
        setBlockProcessingText(true)
        setIsTransitioning(true)

        transitionTimeoutRef.current = setTimeout(() => {
          setRenderState(next)

          fadeInTimeoutRef.current = setTimeout(() => {
            setIsTransitioning(false)
          }, 50)
        }, 300)
      }, 0)
    }

    // Cleanup function
    return () => {
      clearTransitionTimeouts()
    }
  }, [
    isConnected,
    hasNFT,
    hasUsedTokenGate,
    isHydrated,
    renderState,
    isLoading,
    isSwitchingAccount,
  ])

  // Additional cleanup on unmount
  useEffect(() => {
    return () => {
      clearTransitionTimeouts()
    }
  }, [])

  // Reset transition state when account switching completes
  useEffect(() => {
    if (!isSwitchingAccount && isTransitioning) {
      // Ensure we're not stuck in transitioning state after account switch
      const safetyTimeout = setTimeout(() => {
        setIsTransitioning(false)
      }, 100)
      
      return () => clearTimeout(safetyTimeout)
    }
  }, [isSwitchingAccount, isTransitioning])

  // Only show processing if button was clicked (not blocked)
  const busy = (isProcessing || isLoading || isSwitchingAccount) && !blockProcessingText

  // ✅ JSX variable instead of component to satisfy ESLint rule
  const faucetLink = isSepolia ? (
    <a
      href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
      target="_blank"
      rel="noopener noreferrer"
      className={styles.faucetText}
      role="note"
      aria-label="Open Sepolia faucet in new tab"
    >
      If you need testnet Ether, click for a free faucet.
    </a>
  ) : null

  // Loading
  if (!isHydrated || renderState === "loading") {
    return (
      <div className={styles.container} role="status" aria-live="polite">
        <button className={styles.loadingButton} disabled aria-label="Loading NFT actions">
          Loading...
        </button>
      </div>
    )
  }

  // Not connected
  if (renderState === "not-connected") {
    return (
      <div
        className={`${styles.container} ${isTransitioning ? styles.transitioning : ""}`}
        role="group"
        aria-label="Connect wallet actions"
      >
        <ConnectWrapper />
      </div>
    )
  }

  // No NFT — Mint
  if (renderState === "no-nft") {
    return (
      <>
        <div
          className={`${styles.container} ${isTransitioning ? styles.transitioning : ""}`}
          role="group"
          aria-label="Mint NFT action"
          aria-busy={busy}
          aria-live="polite"
        >
          <button
            className={`${styles.mintButton} ${busy ? styles.processing : ""}`}
            onClick={handleMint}
            disabled={isProcessing || isLoading || isSwitchingAccount}
            aria-label={busy ? "Minting NFT, processing" : "Mint NFT"}
            aria-busy={busy}
          >
            {busy ? "Processing..." : "Mint NFT"}
          </button>
        </div>

        {faucetLink}

        <ProcessingModal isVisible={isProcessing} onCancel={handleModalCancel} transactionHash={mintHash} />
      </>
    )
  }

  // Used gate — Burn only
  if (renderState === "used-gate") {
    return (
      <>
        <div
          className={`${styles.container} ${isTransitioning ? styles.transitioning : ""}`}
          role="group"
          aria-label="Burn NFT action"
          aria-busy={busy}
          aria-live="polite"
        >
          <button
            className={`${styles.burnButton} ${busy ? styles.processing : ""}`}
            onClick={handleBurn}
            disabled={isProcessing || isLoading || isSwitchingAccount}
            aria-label={busy ? "Burning NFT, processing" : "Burn NFT"}
            aria-busy={busy}
          >
            {busy ? "Processing..." : "Burn NFT"}
          </button>
        </div>

        {faucetLink}

        <ProcessingModal isVisible={isProcessing} onCancel={handleModalCancel} transactionHash={burnHash} />
      </>
    )
  }

  // Has NFT — Gate + Burn
  return (
    <>
      <div
        className={`${styles.container} ${isTransitioning ? styles.transitioning : ""}`}
        role="group"
        aria-label="Token gate navigation and burn action"
        aria-busy={busy}
        aria-live="polite"
      >
        <Link href="/gate" className={styles.gateButton} aria-label="Go to Token Gate">
          Go to Token Gate
        </Link>

        <button
          className={`${styles.burnButton} ${busy ? styles.processing : ""}`}
          onClick={handleBurn}
          disabled={isProcessing || isLoading || isSwitchingAccount}
          aria-label={busy ? "Burning NFT, processing" : "Burn NFT"}
          aria-busy={busy}
        >
          {busy ? "Processing..." : "Burn NFT"}
        </button>
      </div>

      {faucetLink}

      <ProcessingModal isVisible={isProcessing} onCancel={handleModalCancel} transactionHash={burnHash} />
    </>
  )
}
