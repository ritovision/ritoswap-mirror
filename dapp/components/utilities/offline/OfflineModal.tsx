// components/utilities/offline/OfflineModal.tsx
import React from 'react'
import styles from './OfflineModal.module.css'

interface OfflineModalProps {
  isOffline: boolean
}

export default function OfflineModal({ isOffline }: OfflineModalProps) {
  if (!isOffline) return null

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.iconContainer}>
          <svg className={styles.wifiIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="12" y1="20" x2="12" y2="20.01" strokeWidth={2} strokeLinecap="round" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 15.5a5 5 0 0 1 8 0" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 11.5a10 10 0 0 1 14 0" />
            <line x1="4.8" y1="4.8" x2="19.2" y2="19.2" strokeWidth={2} strokeLinecap="round" />
          </svg>
        </div>
        <h2 className={styles.title}>You're Offline</h2>
        <p className={styles.message}>Please reconnect to the internet to continue using RitoSwap</p>
        <div className={styles.loader}>
          <div className={styles.dot}></div>
          <div className={styles.dot}></div>
          <div className={styles.dot}></div>
        </div>
      </div>
    </div>
  )
}
