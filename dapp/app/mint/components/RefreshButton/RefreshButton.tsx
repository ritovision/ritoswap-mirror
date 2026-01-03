// app/mint/components/RefreshButton/RefreshButton.tsx
'use client'

import React from 'react'
import styles from './RefreshButton.module.css'
import { useNFTData } from '@/app/hooks/useNFTData'
import { nodeConfig } from '@config/node.env'

export default function RefreshButton() {
  const { forceRefresh, isLoading } = useNFTData()
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  // Hide in production using centralized env helper
  if (nodeConfig.isProduction) return null

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await forceRefresh()
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  return (
    <button
      className={styles.button}
      onClick={handleRefresh}
      disabled={isLoading || isRefreshing}
      title="Force refresh NFT data"
    >
      {isRefreshing ? '🔄' : '🔃'}
    </button>
  )
}
