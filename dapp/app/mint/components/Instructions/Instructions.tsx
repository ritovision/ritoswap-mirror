'use client'

import React, { useState, useEffect, useCallback } from 'react'
import styles from './Instructions.module.css'
import { KEY_TOKEN_ADDRESS } from '@config/contracts'

const Instructions: React.FC = () => {
  const [showCopied, setShowCopied] = useState(false)
  const [displayAddress, setDisplayAddress] = useState('')

  const contractAddress = KEY_TOKEN_ADDRESS

  // Truncate address to fit container...
  const calculateDisplayAddress = useCallback(() => {
    if (typeof document === 'undefined' || !contractAddress) return contractAddress
    const wrapper = document.querySelector(`.${styles.addressWrapper}`) as HTMLElement
    if (!wrapper) return contractAddress

    const measureText = (text: string) => {
      const span = document.createElement('span')
      span.style.visibility = 'hidden'
      span.style.position = 'absolute'
      span.style.fontSize = '0.9rem'
      span.style.fontFamily = 'monospace'
      span.style.letterSpacing = '0.5px'
      span.textContent = text
      document.body.appendChild(span)
      const width = span.offsetWidth
      document.body.removeChild(span)
      return width
    }

    const availableWidth = wrapper.offsetWidth - 24
    const fullWidth = measureText(contractAddress)
    if (fullWidth <= availableWidth) return contractAddress

    let dots = 3
    let truncated = `${contractAddress.slice(0, 6)}${'.'.repeat(dots)}${contractAddress.slice(-4)}`
    while (measureText(truncated) > availableWidth && dots < 10) {
      dots++
      truncated = `${contractAddress.slice(0, 6)}${'.'.repeat(dots)}${contractAddress.slice(-4)}`
    }
    if (measureText(truncated) > availableWidth) {
      truncated = `${contractAddress.slice(0, 6)}...${contractAddress.slice(-3)}`
    }
    return truncated
  }, [contractAddress])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null

    const handleResize = () => {
      setDisplayAddress(calculateDisplayAddress())
    }

    const attemptCalculation = () => {
      handleResize()
      if (!displayAddress || displayAddress === contractAddress) {
        timeoutId = setTimeout(attemptCalculation, 50)
      }
    }

    attemptCalculation()

    const wrapper = document.querySelector(`.${styles.addressWrapper}`) as HTMLElement
    let resizeObserver: ResizeObserver | null = null
    if (wrapper && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(handleResize)
      resizeObserver.observe(wrapper)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (resizeObserver) resizeObserver.disconnect()
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [contractAddress, displayAddress, calculateDisplayAddress])

  const handleCopy = async () => {
    if (!contractAddress) return
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(contractAddress)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = contractAddress
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        textArea.remove()
      }
      setShowCopied(true)
      setTimeout(() => setShowCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div
      className={styles.container}
      role="region"
      aria-labelledby="instructions-title"
    >
      <h1 id="instructions-title" className={styles.title}>
        Mint &amp; Burn FAQ
      </h1>

      <button
        className={styles.addressButton}
        onClick={handleCopy}
        title="Click to copy address"
        aria-label="Copy smart contract address"
        aria-describedby="contract-label"
      >
        <span
          id="contract-label"
          className={styles.contractLabel}
        >
          Smart Contract Address:
        </span>
        <div className={styles.addressWrapper} role="group" aria-live="off">
          <span
            className={`${styles.addressText} ${
              showCopied ? styles.fadeOut : styles.fadeIn
            }`}
            aria-label={`Contract address ${contractAddress}`}
          >
            {displayAddress || contractAddress}
          </span>
          <span
            className={`${styles.copiedText} ${
              showCopied ? styles.fadeIn : styles.fadeOut
            }`}
            aria-live="polite"
            aria-atomic="true"
          >
            Copied!
          </span>
        </div>
        <svg
          className={styles.copyIcon}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
        >
          <rect
            x="9"
            y="9"
            width="13"
            height="13"
            rx="2"
            ry="2"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      </button>

      <p className={styles.intro}>
        Here you can mint and burn Colored Keys
      </p>

      <section className={styles.section} aria-labelledby="rules-title">
        <h2 id="rules-title" className={styles.sectionTitle}>
          Rules for Colored Keys:
        </h2>
        <ol className={styles.rulesList}>
          <li>You can only hold 1 key in your wallet a time. Trying to mint another one or having one transferred to you will fail.</li>
          <li>When a new key is first minted, it will be marked "unused"</li>
          <li>You may use the "unused" key to unlock the token gate page and gain access to the exclusive music by Rito Rhymes and messaging channel to send a message to him.</li>
          <li>You get to send one message per key. After sending a messaging, the token will be marked "used".</li>
          <li>Tokens marked "used" can't be used to access the token gate any longer, they must be burned and you need to acquire a new key.</li>
          <li>Come back here to burn your used key and acquire a new one.</li>
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="what-key-title">
        <h2 id="what-key-title" className={styles.sectionTitle}>
          What's the key for?
        </h2>
        <p>
          Opening a lock somewhere on planet Earth. Try the "Gate" page on this platform and see what's inside.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="how-mint-title">
        <h2 id="how-mint-title" className={styles.sectionTitle}>
          How does minting work?
        </h2>
        <p>
          After connecting your wallet and pressing mint to initiate token creation, colors will be randomized for the key and background and all metadata will be published on-chain for your very own key. It is an ERC-721 token.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="how-burn-title">
        <h2 id="how-burn-title" className={styles.sectionTitle}>
          How does burning work?
        </h2>
        <p>
          Click to burn a key you own then token goes bye-bye. You no longer have a key and are thus eligible to mint a new one or have one transferred to you.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="storage-title">
        <h2 id="storage-title" className={styles.sectionTitle}>
          Where is the NFT's content stored?
        </h2>
        <p>
          Everything is stored fully on-chain on Ethereum mainnet. The image is an inline SVG with randomized colors on every mint and all other metadata are stored directly alongside it.
        </p>
      </section>
    </div>
  )
}

export default Instructions
