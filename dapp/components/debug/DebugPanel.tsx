// components/debug/DebugPanel.tsx
"use client"
import React, { useState, useEffect } from 'react'
import styles from './DebugPanel.module.css'
import { useAccount } from 'wagmi'
import { getTargetChainId, getTargetChainName, isActiveChain, ChainType } from '@/app/utils/chainConfig'
import { isSiweEnabled, getDomain } from '@/app/lib/siwe/siwe.client'
import { isRateLimitEnabled } from '@/app/lib/rateLimit/rateLimit.client'
import { showRateLimitModal } from '@/components/utilities/rateLimitModal/RateLimitModal'

import { publicEnv, publicConfig } from '@config/public.env'

interface EndpointTest {
  name: string
  endpoint: string
  method: 'GET' | 'POST'
  getBody?: () => Record<string, unknown>
}

export default function DebugPanel({ forceVisible }: { forceVisible?: boolean } = {}) {
  const { address, isConnected, chainId } = useAccount()
  const [isMinimized, setIsMinimized] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, string>>({})
  const [serverStatus, setServerStatus] = useState<{
    stateWorkerUrl: boolean
    stateWorkerApiKey: boolean
  }>({ stateWorkerUrl: false, stateWorkerApiKey: false })
  const [isOnline, setIsOnline] = useState(true)
  
  // Only show in development
  useEffect(() => {
    setIsVisible(forceVisible ?? publicConfig.isDevelopment)
    // Check server status
    checkServerStatus()
    
    // Monitor online status
    const checkOnlineStatus = () => {
      setIsOnline(navigator.onLine)
    }
    
    checkOnlineStatus()
    const interval = setInterval(checkOnlineStatus, 1000)
    
    window.addEventListener('online', checkOnlineStatus)
    window.addEventListener('offline', checkOnlineStatus)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('online', checkOnlineStatus)
      window.removeEventListener('offline', checkOnlineStatus)
    }
  }, [forceVisible])
  
  const checkServerStatus = async () => {
    try {
      const res = await fetch('/api/debug/status')
      if (res.ok) {
        const data = await res.json()
        setServerStatus(data)
      }
    } catch (e) {
      console.error('Failed to check server status', e)
    }
  }
  
  if (!isVisible) return null
  
  const endpoints: EndpointTest[] = [
    {
      name: 'Nonce',
      endpoint: '/api/nonce',
      method: 'GET'
    },
    {
      name: 'Gate Access',
      endpoint: '/api/gate-access',
      method: 'POST',
      getBody: () => ({
        address: address || '0x0000000000000000000000000000000000000000',
        signature: '0x00',
        tokenId: 1,
        timestamp: Date.now()
      })
    },
    {
      name: 'Verify Token',
      endpoint: '/api/verify-token-gate',
      method: 'POST',
      getBody: () => ({
        tokenId: 1,
        message: 'Test message',
        signature: '0x00',
        signMessage: 'Test sign message',
        address: address || '0x0000000000000000000000000000000000000000',
        timestamp: Date.now()
      })
    },
    {
      name: 'Token Status',
      endpoint: '/api/token-status/1',
      method: 'GET'
    }
  ]
  
  const testEndpoint = async (test: EndpointTest) => {
    try {
      const options: RequestInit = {
        method: test.method,
        headers: test.method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: test.method === 'POST' && test.getBody ? JSON.stringify(test.getBody()) : undefined
      }
      
      const response = await fetch(test.endpoint, options)
      const data = await response.json()
      
      if (response.status === 429) {
        // Show rate limit modal
        showRateLimitModal({
          limit: data.limit,
          remaining: data.remaining,
          retryAfter: data.retryAfter
        })
        setTestResults(prev => ({
          ...prev,
          [test.name]: `Rate limited! Remaining: ${data.remaining}/${data.limit}`
        }))
      } else {
        setTestResults(prev => ({
          ...prev,
          [test.name]: `${response.status}: ${JSON.stringify(data).slice(0, 50)}...`
        }))
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [test.name]: `Error: ${error}`
      }))
    }
  }
  
  const envVars = {
    'Network Status': isOnline ? '🟢 Online' : '🔴 Offline',
    'PWA Enabled': publicEnv.NEXT_PUBLIC_SW ? '✅' : '❌',
    'SIWE Enabled': isSiweEnabled() ? '✅' : '❌',
    'Rate Limit Enabled': isRateLimitEnabled() ? '✅' : '❌',
    'State Worker URL': serverStatus.stateWorkerUrl ? '✅ Set' : '❌ Not Set',
    'State Worker API Key': serverStatus.stateWorkerApiKey ? '✅ Set' : '❌ Not Set',
    'Domain': getDomain(),
    'Domain Env': publicEnv.NEXT_PUBLIC_DOMAIN || 'Not Set (using browser)',
    'Target Chain': `${getTargetChainName()} (${getTargetChainId()})`,
    'Current Chain': chainId || 'Not Connected',
    // Use centralized chain config (enum) instead of env flags
    'RitoNet': isActiveChain(ChainType.RITONET) ? '✅' : '❌',
    'Sepolia': isActiveChain(ChainType.SEPOLIA) ? '✅' : '❌',
    'Ethereum': isActiveChain(ChainType.ETHEREUM) ? '✅' : '❌',
  }
  
  if (isMinimized) {
    return (
      <div className={styles.minimized} onClick={() => setIsMinimized(false)}>
        🐛 Debug {!isOnline && '🔴'}
      </div>
    )
  }
  
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3>🐛 Debug Panel {!isOnline && '(Offline)'}</h3>
        <button onClick={() => setIsMinimized(true)} className={styles.minimize}>
          _
        </button>
      </div>
      
      <div className={styles.section}>
        <h4>Environment Variables</h4>
        <div className={styles.envList}>
          {Object.entries(envVars).map(([key, value]) => (
            <div key={key} className={styles.envItem}>
              <span className={styles.envKey}>{key}:</span>
              <span className={styles.envValue}>{value}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className={styles.section}>
        <h4>Wallet Status</h4>
        <div className={styles.envList}>
          <div className={styles.envItem}>
            <span className={styles.envKey}>Connected:</span>
            <span className={styles.envValue}>{isConnected ? '✅' : '❌'}</span>
          </div>
          <div className={styles.envItem}>
            <span className={styles.envKey}>Address:</span>
            <span className={styles.envValue}>
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not Connected'}
            </span>
          </div>
        </div>
      </div>
      
      <div className={styles.section}>
        <h4>Endpoint Testing</h4>
        <div className={styles.endpointTests}>
          {endpoints.map((test) => (
            <div key={test.name} className={styles.testRow}>
              <button 
                onClick={() => testEndpoint(test)}
                className={styles.testButton}
                disabled={!isOnline}
              >
                Test {test.name}
              </button>
              {testResults[test.name] && (
                <div className={styles.testResult}>
                  {testResults[test.name]}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <div className={styles.footer}>
        <small>Development only - Rate limits reset per minute/hour</small>
      </div>
    </div>
  )
}
