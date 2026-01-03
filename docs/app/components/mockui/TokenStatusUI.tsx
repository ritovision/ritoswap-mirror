// docs/app/components/mockui/TokenStatusUI.tsx
'use client'

import React, { useState } from 'react'
import styles from './TokenStatus.module.css'
import Dropdown from '@components/utilities/dropdown/Dropdown'

/** All possible status texts */
export type TokenStatusState =
  | 'loading'
  | 'not-connected'
  | 'used-gate'
  | 'has-nft'
  | 'no-nft'

export interface TokenStatusUIProps {
  /** Which state to render */
  state: TokenStatusState
}

/**
 * Pure-UI TokenStatus: just renders the right text for each `state`.
 */
export const TokenStatusUI: React.FC<TokenStatusUIProps> = ({ state }) => {
  const textMap: Record<TokenStatusState, string> = {
    loading: 'Loading...',
    'not-connected': 'You are not signed in',
    'used-gate': 'You have a used key...',
    'has-nft': 'You have an unused key!',
    'no-nft': "You don't have a key yet",
  }

  return (
    <div
      className={styles.container}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <h1 className={styles.text}>
        {textMap[state]}
      </h1>
    </div>
  )
}

/**
 * Showcase wrapper: pick any `state` from a dropdown.
 */
export const TokenStatusShowcase: React.FC = () => {
  const [state, setState] = useState<TokenStatusState>('loading')

  const stateLabels: Record<TokenStatusState, string> = {
    loading: '⏳ Loading…',
    'not-connected': '🚫 Not signed in',
    'used-gate': '🔥 Used key',
    'has-nft': '🗝️ Unused key',
    'no-nft': '⚪ No key yet',
  }

  // invert for dropdown → state lookup
  const labelToState = Object.fromEntries(
    Object.entries(stateLabels).map(([s, label]) => [label, s])
  ) as Record<string, TokenStatusState>

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        alignItems: 'center',
      }}
    >
      {/* 1) Render your status */}
      <TokenStatusUI state={state} />

      {/* 2) Choose a state */}
      <Dropdown
        label="Select Status"
        items={Object.values(stateLabels)}
        selectedValue={stateLabels[state]}
        onChange={(label) => {
          setState(labelToState[label])
        }}
      />
    </div>
  )
}
