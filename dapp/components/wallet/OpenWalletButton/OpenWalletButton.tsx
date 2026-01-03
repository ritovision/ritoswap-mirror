// components/utilities/wallet/OpenWalletButton/OpenWalletButton.tsx
"use client"
import React from 'react'
import { useAccount } from 'wagmi'
import { isMobileDevice } from '@/app/utils/mobile'
import { openWalletDeeplink } from '@/app/utils/walletDeeplink'
import styles from './OpenWalletButton.module.css'

export default function OpenWalletButton() {
  const { connector, isConnected } = useAccount()
  
  // Only show on mobile with WalletConnect
  if (!isMobileDevice() || !isConnected || connector?.id !== 'walletConnect') {
    return null
  }
  
  return (
    <button 
      className={styles.openWalletButton}
      onClick={() => openWalletDeeplink()}
      aria-label="Open wallet app"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 6H14C14 4.89543 13.1046 4 12 4C10.8954 4 10 4.89543 10 6Z" stroke="currentColor" strokeWidth="2"/>
        <path d="M20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12C4 7.58172 7.58172 4 12 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M18 12L15 9M18 12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Open Wallet
    </button>
  )
}
