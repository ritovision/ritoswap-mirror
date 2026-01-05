'use client'
// docs/components/ui/NFTScreenUI.tsx

import React, { useState } from 'react'
import styles from './NFTScreen.module.css'
import Dropdown from '@components/utilities/dropdown/Dropdown'

/** Possible states for the NFT screen */
type NFTScreenState = 'locked' | 'no-nft' | 'has-nft'

interface NFTScreenUIProps {
  state: NFTScreenState
  backgroundColor?: string
  keyColor?: string
  tokenId?: number
}

/**
 * Renders the NFT lock/key visualization.
 * Applies a higher stacking context so controls (dropdown menus) can go behind it.
 */
export function NFTScreenUI({
  state,
  backgroundColor = '#FF6B6B',
  keyColor = '#4ECDC4',
  tokenId = 42,
}: NFTScreenUIProps) {
  if (state === 'locked') {
    return (
      <div
        className={styles.wrapper}
        style={{ position: 'relative', zIndex: 1, }}
      >
        <div className={styles.container}>
          <div className={styles.iconWrapper}>
            <img
              src="/images/icons/lock.png"
              alt="Locked"
              width={150}
              height={150}
            />
          </div>
        </div>
      </div>
    )
  }

  const hasNFT = state === 'has-nft'
  return (
    <div
      className={styles.wrapper}
      style={{ position: 'relative', zIndex: 1 }}
    >
      <div className={styles.tokenIdText}>
        {hasNFT ? `Key #${tokenId}` : ''}
      </div>
      <div className={styles.container}>
        <div
          className={styles.keyWrapper}
          style={{
            backgroundColor: hasNFT ? backgroundColor : 'rgba(0,0,0,0.3)',
          }}
        >
          <svg
            viewBox="0 0 200 100"
            xmlns="http://www.w3.org/2000/svg"
            className={styles.key}
            style={{ color: hasNFT ? keyColor : 'white' }}
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
      </div>
    </div>
  )
}

/**
 * Showcase wrapper that lets you pick state (and custom colours)
 * The NFT screen renders _first_ so the dropdown lives beneath it.
 */
export function NFTScreenShowcase() {
  const [state, setState] = useState<NFTScreenState>('locked')
  const [isCustom, setIsCustom] = useState(false)
  const [customBg, setCustomBg] = useState('#FF6B6B')
  const [customKey, setCustomKey] = useState('#4ECDC4')

  const stateLabels = {
    locked: '🔒 Disconnected',
    'no-nft': '⚪ Connected - No NFT',
    'has-nft': '🗝️ Has NFT',
    custom: '🎨 Custom Colors',
  } as const

  const selectedLabel = isCustom
    ? stateLabels.custom
    : stateLabels[state]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        alignItems: 'center',
      }}
    >
      {/* 1) NFT screen on top of the stacking order */}
      <NFTScreenUI
        state={state}
        backgroundColor={isCustom ? customBg : undefined}
        keyColor={isCustom ? customKey : undefined}
      />

      {/* 2) Controls rendered underneath in the DOM order */}
      <Dropdown
        label="Select State"
        items={Object.values(stateLabels)}
        selectedValue={selectedLabel}
        onChange={(val) => {
          if (val === stateLabels.custom) {
            setIsCustom(true)
            setState('has-nft')
          } else {
            setIsCustom(false)
            const newState = (
              Object.entries(stateLabels) as [NFTScreenState, string][]
            ).find(([, label]) => label === val)?.[0]
            if (newState) setState(newState)
          }
        }}
      />

      {isCustom && (
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
          }}
        >
          <label style={{ color: '#fff' }}>
            Background:
            <input
              type="color"
              value={customBg}
              onChange={(e) => setCustomBg(e.target.value)}
              style={{ marginLeft: '0.5rem', cursor: 'pointer' }}
            />
          </label>
          <label style={{ color: '#fff' }}>
            Key:
            <input
              type="color"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              style={{ marginLeft: '0.5rem', cursor: 'pointer' }}
            />
          </label>
        </div>
      )}
    </div>
  )
}
