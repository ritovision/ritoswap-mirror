"use client"
import React, { useEffect, useState } from 'react'
import OfflineModal from './OfflineModal'

type DebugWindow = { __isOffline?: boolean }

export default function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    // Simple connection check
    const checkConnection = () => {
      const offlineOverride = (window as unknown as { __RITOSWAP_OFFLINE_OVERRIDE__?: boolean }).__RITOSWAP_OFFLINE_OVERRIDE__
      const offline = typeof offlineOverride === 'boolean' ? offlineOverride : !navigator.onLine
      setIsOffline(offline)
      
      // Store in window for debug panel
      if (typeof window !== 'undefined') {
        (window as unknown as DebugWindow).__isOffline = offline
      }
    }
    
    // Initial check
    checkConnection()

    // Event listeners
    const handleConnectionChange = () => {
      checkConnection()
    }

    // Periodic check for edge-cases (e.g. airplane mode)
    const interval = window.setInterval(checkConnection, 30000)

    window.addEventListener('online', handleConnectionChange)
    window.addEventListener('offline', handleConnectionChange)
    window.addEventListener('focus', checkConnection)

    return () => {
      clearInterval(interval)
      window.removeEventListener('online', handleConnectionChange)
      window.removeEventListener('offline', handleConnectionChange)
      window.removeEventListener('focus', checkConnection)
    }
  }, [])

  return (
    <>
      {children}
      <OfflineModal isOffline={isOffline} />
    </>
  )
}
