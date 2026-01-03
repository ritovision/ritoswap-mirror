// app/mint/components/NFTScreen/NFTScreen.tsx
"use client"
import React, { useState, useEffect, useRef, useCallback } from 'react'
import styles from './NFTScreen.module.css'
import Image from 'next/image'
import { useAccount } from 'wagmi'
import { useNFTStore } from '@store/nftStore'

export default function NFTScreen() {
  const { isConnected, isConnecting } = useAccount()
  const {
    hasNFT,
    backgroundColor,
    keyColor,
    tokenId,
    isSwitchingAccount,
    previousData,
  } = useNFTStore()

  const [isInitialized, setIsInitialized] = useState(false)
  const [displayState, setDisplayState] = useState<
    'lock' | 'default-key' | 'user-key' | 'loading'
  >('loading')
  const [isStable, setIsStable] = useState(false)
  const stateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initial load - wait for wagmi to settle
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialized(true)
    }, 300) // Give wagmi time to restore connection
    return () => clearTimeout(timer)
  }, [])

  // Determine target state (memoized to satisfy react-hooks/exhaustive-deps)
  const getTargetState = useCallback(() => {
    if (!isInitialized || isConnecting) {
      return 'loading'
    }

    if (!isConnected) {
      return 'lock'
    }

    if (isSwitchingAccount && previousData) {
      return previousData.hasNFT && previousData.backgroundColor && previousData.keyColor
        ? 'user-key'
        : 'default-key'
    }

    return hasNFT && backgroundColor && keyColor ? 'user-key' : 'default-key'
  }, [
    isInitialized,
    isConnecting,
    isConnected,
    isSwitchingAccount,
    previousData,
    hasNFT,
    backgroundColor,
    keyColor,
  ])

  // Debounced state updates to prevent flashing
  useEffect(() => {
    const targetState = getTargetState()

    // Clear any pending state change
    if (stateTimeoutRef.current) {
      clearTimeout(stateTimeoutRef.current)
    }

    // If we're in loading state and target is still loading, don't set timer
    if (displayState === 'loading' && targetState === 'loading') {
      return
    }

    // If we're transitioning from loading to a real state, do it immediately
    if (displayState === 'loading' && targetState !== 'loading') {
      setTimeout(() => {
        setDisplayState(targetState)
        setIsStable(true)
      }, 0)
      return
    }

    // For all other state changes, debounce to prevent flashing
    stateTimeoutRef.current = setTimeout(() => {
      if (targetState !== displayState) {
        setDisplayState(targetState)
      }
    }, 200) // Small delay to prevent rapid flashing

    return () => {
      if (stateTimeoutRef.current) {
        clearTimeout(stateTimeoutRef.current)
      }
    }
  }, [
    isInitialized,
    isConnecting,
    isConnected,
    hasNFT,
    backgroundColor,
    keyColor,
    isSwitchingAccount,
    previousData,
    displayState,
    getTargetState,
  ])

  // Use the appropriate data based on switching state
  const displayData =
    isSwitchingAccount && previousData
      ? {
          backgroundColor: previousData.backgroundColor,
          keyColor: previousData.keyColor,
          tokenId: previousData.tokenId,
        }
      : { backgroundColor, keyColor, tokenId }

  // Render lock icon or key SVG
  const renderContent = () => {
    if (displayState === 'loading') {
      // Show nothing during initial load
      return null
    }

    if (displayState === 'lock') {
      return (
        <div className={styles.iconWrapper} data-testid="lock-icon">
          <Image
            src="/images/utilities/icons/lock.png"
            alt="Wallet locked"
            width={150}
            height={150}
            priority
          />
        </div>
      )
    }

    // Key view
    const wrapperStyle =
      displayState === 'user-key'
        ? {
            backgroundColor: displayData.backgroundColor ?? 'rgba(0,0,0,0.3)',
            transition: isSwitchingAccount
              ? 'none'
              : 'background-color 1s ease-in-out',
          }
        : { backgroundColor: 'rgba(0,0,0,0.3)' }

    const svgColor =
      displayState === 'user-key' ? displayData.keyColor ?? 'white' : 'white'

    // **ARIA**: role="img" + aria-label
    const ariaLabel =
      displayData.tokenId != null
        ? `Key number ${displayData.tokenId}`
        : 'Default key'

    return (
      <div
        className={styles.keyWrapper}
        style={wrapperStyle}
        data-testid="key-wrapper"
        role="img"
        aria-label={ariaLabel}
      >
        <svg
          viewBox="0 0 200 100"
          xmlns="http://www.w3.org/2000/svg"
          className={styles.key}
          data-testid="key-svg"
          style={{ color: svgColor }}
        >
          <circle
            cx="60"
            cy="50"
            r="20"
            fill="none"
            stroke="currentColor"
            strokeWidth={10}
          />
          <rect
            x="80"
            y="45"
            width="100"
            height="10"
            rx={5}
            fill="currentColor"
          />
          <path
            d="M145 30 A5 5 0 0 1 150 35 V46 H140 V35 A5 5 0 0 1 145 30 Z"
            fill="currentColor"
          />
          <path
            d="M165 36 A5 5 0 0 1 170 41 V46 H160 V41 A5 5 0 0 1 165 36 Z"
            fill="currentColor"
          />
        </svg>
      </div>
    )
  }

  // Show token ID above
  const displayTokenId =
    displayData.tokenId ??
    (hasNFT && tokenId != null ? tokenId : null)

  return (
    <div
      className={[
        styles.wrapper,
        isSwitchingAccount && styles.switching,
        isStable && styles.stable,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={styles.tokenIdText}
        aria-live="polite"
      >
        {displayTokenId != null ? `Key #${displayTokenId}` : ''}
      </div>
      <div className={styles.container}>{renderContent()}</div>
    </div>
  )
}
