// docs/app/components/mockui/ButtonSectionUI.tsx
'use client'

import React, { useState } from 'react'
import styles from './ButtonSection.module.css'
import Dropdown from '@components/utilities/dropdown/Dropdown'

/** All possible visual states of the section */
export type ButtonSectionState =
  | 'loading'
  | 'not-connected'
  | 'no-nft'
  | 'has-nft'
  | 'used-gate'

export interface ButtonSectionUIProps {
  /** which of the above to render */
  state: ButtonSectionState
  /** if true, buttons show “Processing…” styling */
  isProcessing?: boolean
}

/**
 * Pure-UI version of your ButtonSection: no wagmi, no stores,
 * just React + CSS to illustrate all five cases.
 */
export const ButtonSectionUI: React.FC<ButtonSectionUIProps> = ({
  state,
  isProcessing = false,
}) => {
  switch (state) {
    case 'loading':
      return (
        <div className={styles.container}>
          <button className={styles.loadingButton} disabled>
            Loading...
          </button>
        </div>
      )

    case 'not-connected':
      return (
        <div className={styles.container}>
          {/* replaces the text button with your custom image */}
          <img
            src="/images/ui/connectbutton.png"
            alt="Connect Wallet"
            style={{ width: '200px' }}
          />
        </div>
      )

    case 'no-nft':
      return (
        <div className={styles.container}>
          <button
            className={`${styles.mintButton} ${
              isProcessing ? styles.processing : ''
            }`}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Mint NFT'}
          </button>
        </div>
      )

    case 'used-gate':
      return (
        <div className={styles.container}>
          <button
            className={`${styles.burnButton} ${
              isProcessing ? styles.processing : ''
            }`}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Burn NFT'}
          </button>
        </div>
      )

    case 'has-nft':
      return (
        <div className={styles.container}>
          <button className={styles.gateButton}>
            Go to Token Gate
          </button>
          <button
            className={`${styles.burnButton} ${
              isProcessing ? styles.processing : ''
            }`}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Burn NFT'}
          </button>
        </div>
      )

    default:
      return null
  }
}

/**
 * Showcase wrapper: lets you pick any of the five states
 * (and toggle “Processing” for the mint/burn cases).
 */
export const ButtonSectionShowcase: React.FC = () => {
  const [state, setState] =
    useState<ButtonSectionState>('loading')
  const [isProcessing, setIsProcessing] =
    useState<boolean>(false)

  const stateLabels: Record<ButtonSectionState, string> = {
    loading: '⏳ Loading',
    'not-connected': '🚫 Not Connected',
    'no-nft': '💎 No NFT',
    'has-nft': '🔑 Has NFT',
    'used-gate': '🔥 Used Gate',
  }

  // invert the map so Dropdown can tell us which state to set
  const labelToState = Object.fromEntries(
    Object.entries(stateLabels).map(([k, v]) => [v, k])
  ) as Record<string, ButtonSectionState>

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        alignItems: 'center',
      }}
    >
      {/* 1) the UI itself */}
      <ButtonSectionUI
        state={state}
        isProcessing={isProcessing}
      />

      {/* 2) pick any of the five states */}
      <Dropdown
        label="Select State"
        items={Object.values(stateLabels)}
        selectedValue={stateLabels[state]}
        onChange={(label) => {
          setState(labelToState[label])
          setIsProcessing(false)
        }}
      />

      {/* 3) only show “Processing” toggle when it makes sense */}
      {['no-nft', 'used-gate', 'has-nft'].includes(state) && (
        <label style={{ color: '#fff' }}>
          Processing{' '}
          <input
            type="checkbox"
            checked={isProcessing}
            onChange={(e) =>
              setIsProcessing(e.target.checked)
            }
            style={{ marginLeft: '0.5rem' }}
          />
        </label>
      )}
    </div>
  )
}
