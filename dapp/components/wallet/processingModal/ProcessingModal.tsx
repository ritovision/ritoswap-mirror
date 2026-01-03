// FILE: components/utilities/wallet/processingModal/ProcessingModal.tsx
"use client"

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { isMobileDevice } from '@/app/utils/mobile'
import { openWalletDeeplink } from '@/app/utils/walletDeeplink'
import { getTargetChainId, CHAIN_IDS } from '@config/chain'
import { publicEnv } from '@config/public.env'
import styles from './ProcessingModal.module.css'

export interface ProcessingModalProps {
  isVisible: boolean
  onCancel: () => void
  transactionHash?: `0x${string}` | null
  /** Override target chain for block explorer link (useful for Storybook). */
  targetChainIdOverride?: number
}

export default function ProcessingModal({
  isVisible,
  onCancel,
  transactionHash,
  targetChainIdOverride,
}: ProcessingModalProps) {
  const [shouldRender, setShouldRender] = useState(false)
  const [isShowing, setIsShowing] = useState(false)
  const [showExplorerLink, setShowExplorerLink] = useState(false)
  const [currentExplorerUrl, setCurrentExplorerUrl] = useState<string | null>(null)
  
  // Refs for focus management
  const modalRef = useRef<HTMLDivElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Determine if device is mobile
  const isMobile = isMobileDevice()

  // Get block explorer URL based on current network
  const getBlockExplorerUrl = useCallback((hash: string) => {
    const chainId = targetChainIdOverride ?? getTargetChainId()

    switch (chainId) {
      case CHAIN_IDS.sepolia:
        return `https://sepolia.etherscan.io/tx/${hash}`
      case CHAIN_IDS.ethereum:
        return `https://etherscan.io/tx/${hash}`
      case CHAIN_IDS.ritonet: {
        const ritonetExplorerUrl = publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_EXPLORER_URL
        return ritonetExplorerUrl ? `${ritonetExplorerUrl}/tx/${hash}` : null
      }
      default:
        return null
    }
  }, [targetChainIdOverride])

  // Handle transaction hash changes
  useEffect(() => {
    if (transactionHash && isVisible) {
      const url = getBlockExplorerUrl(transactionHash)
      if (url) {
        setTimeout(() => {
          setShowExplorerLink(true)
          setCurrentExplorerUrl(url)
        }, 0)
      }
    }
  }, [transactionHash, isVisible, getBlockExplorerUrl])

  // Reset explorer link when modal closes
  useEffect(() => {
    if (!isVisible) {
      const resetTimer = setTimeout(() => {
        setShowExplorerLink(false)
        setCurrentExplorerUrl(null)
      }, 1000) // Reset after fade out completes
      return () => clearTimeout(resetTimer)
    }
  }, [isVisible])

  useEffect(() => {
    if (isVisible) {
      setTimeout(() => setShouldRender(true), 0)
      const showTimer = setTimeout(() => {
        setIsShowing(true)
      }, 50)
      return () => clearTimeout(showTimer)
    } else {
      setTimeout(() => setIsShowing(false), 0)
      const hideTimer = setTimeout(() => {
        setShouldRender(false)
      }, 1000)
      return () => clearTimeout(hideTimer)
    }
  }, [isVisible])

  // Focus management
  useEffect(() => {
    if (isVisible && isShowing) {
      // Store current focus
      previousFocusRef.current = document.activeElement as HTMLElement

      // Focus the modal container for accessibility
      modalRef.current?.focus()

      // Trap focus within modal
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onCancel()
        }
        
        // Focus trap logic
        if (e.key === 'Tab') {
          const focusableElements = modalRef.current?.querySelectorAll(
            'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
          
          if (focusableElements && focusableElements.length > 0) {
            const firstElement = focusableElements[0] as HTMLElement
            const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement
            
            if (e.shiftKey && document.activeElement === firstElement) {
              e.preventDefault()
              lastElement.focus()
            } else if (!e.shiftKey && document.activeElement === lastElement) {
              e.preventDefault()
              firstElement.focus()
            }
          }
        }
      }
      
      document.addEventListener('keydown', handleKeyDown)
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    } else if (!isVisible && previousFocusRef.current) {
      // Return focus to previous element when modal closes
      previousFocusRef.current.focus()
    }
  }, [isVisible, isShowing, onCancel])

  if (!shouldRender) return null

  return (
    <div
      data-testid="processing-modal-overlay"
      className={`${styles.modalOverlay} ${isShowing ? styles.visible : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="processing-modal-title"
      aria-describedby="processing-modal-description"
    >
      <div className={styles.modal} ref={modalRef} tabIndex={-1}>
        <h2 id="processing-modal-title" className="sr-only">
          Transaction Processing
        </h2>
        
        <p id="processing-modal-description" className={styles.message}>
          Open your connected wallet app or extension to continue
        </p>
        
        {showExplorerLink && currentExplorerUrl && (
          <a
            href={currentExplorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.explorerLink}
            aria-label="View pending transaction on block explorer (opens in new tab)"
          >
            Pending TX at Block Explorer
          </a>
        )}
        
        <div className={styles.buttonRow} role="group" aria-label="Modal actions">
          <button
            ref={cancelButtonRef}
            data-testid="cancel-button"
            className={styles.cancelButton}
            onClick={onCancel}
            aria-label="Cancel transaction and close modal"
          >
            Cancel
          </button>
          {isMobile && (
            <button
              data-testid="open-wallet-button"
              className={styles.openWalletButton}
              onClick={() => openWalletDeeplink()}
              aria-label="Open wallet application"
            >
              Open Wallet
            </button>
          )}
        </div>
        
        <p className={styles.subtext} role="note">
          You may still need to clear stale transaction requests from your
          wallet manually
        </p>
      </div>
    </div>
  )
}
