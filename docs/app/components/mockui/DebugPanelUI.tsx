'use client'

import React, { useState, useEffect } from 'react'
import styles from './DebugPanel.module.css'

interface DebugPanelUIProps {
  isOnline?: boolean
  isPWAEnabled?: boolean
  isSIWEEnabled?: boolean
  isRateLimitEnabled?: boolean
  redisApiSet?: boolean
  redisKeySet?: boolean
  targetChain?: string
  currentChain?: string | number
  isWalletConnected?: boolean
  walletAddress?: string
  domain?: string
  domainEnv?: string
  isRitoNet?: boolean
  isSepolia?: boolean
  isEthereum?: boolean
  testResults?: Record<string, string>
  onTestEndpoint?: (endpoint: string) => void
  onMinimize?: () => void
}

export function DebugPanelUI({
  isOnline = true,
  isPWAEnabled = false,
  isSIWEEnabled = false,
  isRateLimitEnabled = false,
  redisApiSet = false,
  redisKeySet = false,
  targetChain = 'Ethereum (1)',
  currentChain = 'Not Connected',
  isWalletConnected = false,
  walletAddress = '',
  domain = 'localhost:3000',
  domainEnv = 'Not Set (using browser)',
  isRitoNet = false,
  isSepolia = false,
  isEthereum = true,
  testResults = {},
  onTestEndpoint = () => {},
  onMinimize = () => {}
}: DebugPanelUIProps) {
  const [isMinimized, setIsMinimized] = useState(false)

  if (isMinimized) {
    return (
      <div 
        className={styles.minimized} 
        onClick={() => setIsMinimized(false)}
      >
        🐛 Debug {!isOnline && '🔴'}
      </div>
    )
  }

  const envVars = {
    'Network Status': isOnline ? '🟢 Online' : '🔴 Offline',
    'PWA Enabled': isPWAEnabled ? '✅' : '❌',
    'SIWE Enabled': isSIWEEnabled ? '✅' : '❌',
    'Rate Limit Enabled': isRateLimitEnabled ? '✅' : '❌',
    'Redis API': redisApiSet ? '✅ Set' : '❌ Not Set',
    'Redis Key': redisKeySet ? '✅ Set' : '❌ Not Set',
    'Domain': domain,
    'Domain Env': domainEnv,
    'Target Chain': targetChain,
    'Current Chain': currentChain,
    'RitoNet': isRitoNet ? '✅' : '❌',
    'Sepolia': isSepolia ? '✅' : '❌',
    'Ethereum': isEthereum ? '✅' : '❌',
  }

  const endpoints = [
    { name: 'Nonce', endpoint: '/api/nonce' },
    { name: 'Gate Access', endpoint: '/api/gate-access' },
    { name: 'Verify Token', endpoint: '/api/verify-token-gate' },
    { name: 'Token Status', endpoint: '/api/token-status/1' }
  ]

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3>🐛 Debug Panel {!isOnline && '(Offline)'}</h3>
        <button 
          onClick={() => {
            setIsMinimized(true)
            onMinimize()
          }} 
          className={styles.minimize}
        >
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
            <span className={styles.envValue}>{isWalletConnected ? '✅' : '❌'}</span>
          </div>
          <div className={styles.envItem}>
            <span className={styles.envKey}>Address:</span>
            <span className={styles.envValue}>
              {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Not Connected'}
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
                onClick={() => onTestEndpoint(test.name)}
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

// Showcase component with interactive toggles
export function DebugPanelShowcase() {
  const [state, setState] = useState({
    isOnline: true,
    isPWAEnabled: false,
    isSIWEEnabled: false,
    isRateLimitEnabled: false,
    redisApiSet: false,
    redisKeySet: false,
    isWalletConnected: false,
    isRitoNet: false,
    isSepolia: false,
    isEthereum: true,
  })
  
  const [testResults, setTestResults] = useState<Record<string, string>>({})
  const [clickCounts, setClickCounts] = useState<Record<string, number>>({})
  const [showRateLimitModal, setShowRateLimitModal] = useState(false)
  const [rateLimitInfo, setRateLimitInfo] = useState({ endpoint: '', remaining: 0 })

  // Reset click counts after 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setClickCounts({})
    }, 10000)
    return () => clearInterval(timer)
  }, [])

  const handleToggle = (key: keyof typeof state) => {
    setState(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleTestEndpoint = (endpoint: string) => {
    const newCount = (clickCounts[endpoint] || 0) + 1
    setClickCounts(prev => ({ ...prev, [endpoint]: newCount }))

    if (newCount > 3) {
      // Show rate limit modal
      setRateLimitInfo({ endpoint, remaining: 10 - newCount })
      setShowRateLimitModal(true)
      setTestResults(prev => ({
        ...prev,
        [endpoint]: `Rate limited! Remaining: ${10 - newCount}/10`
      }))
    } else {
      // Simulate successful response
      setTestResults(prev => ({
        ...prev,
        [endpoint]: `200: {"success": true, "data": "test response"}...`
      }))
    }
  }

  const targetChain = state.isRitoNet ? 'RitoNet (90999999)' : 
                     state.isSepolia ? 'Sepolia (11155111)' : 
                     'Ethereum (1)'

  const toggles = [
    { key: 'isOnline', label: 'Online' },
    { key: 'isPWAEnabled', label: 'PWA Enabled' },
    { key: 'isSIWEEnabled', label: 'SIWE Enabled' },
    { key: 'isRateLimitEnabled', label: 'Rate Limit' },
    { key: 'redisApiSet', label: 'Redis API' },
    { key: 'redisKeySet', label: 'Redis Key' },
    { key: 'isWalletConnected', label: 'Wallet Connected' },
    { key: 'isRitoNet', label: 'RitoNet' },
    { key: 'isSepolia', label: 'Sepolia' },
    { key: 'isEthereum', label: 'Ethereum' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center' }}>
      <DebugPanelUI
        {...state}
        targetChain={targetChain}
        currentChain={state.isWalletConnected ? '1' : 'Not Connected'}
        walletAddress={state.isWalletConnected ? '0x742d35Cc6634C0532925a3b844Bc9e7595f6BDEF' : ''}
        domain="ritoswap.com"
        domainEnv={state.isSIWEEnabled ? "ritoswap.com" : "Not Set (using browser)"}
        testResults={testResults}
        onTestEndpoint={handleTestEndpoint}
      />

      <div className={styles.toggleContainer}>
        {toggles.map(({ key, label }) => (
          <label key={key} className={styles.toggleItem}>
            <input
              type="checkbox"
              checked={state[key as keyof typeof state]}
              onChange={() => handleToggle(key as keyof typeof state)}
              className={styles.checkbox}
            />
            <span className={styles.checkmark} />
            <span className={styles.toggleLabel}>{label}</span>
          </label>
        ))}
      </div>

      {showRateLimitModal && (
        <>
          <div 
            className={styles.modalBackdrop} 
            onClick={() => setShowRateLimitModal(false)}
          />
          <div className={styles.rateLimitModal}>
            <img 
              src="/images/ui/ratelimitmodal.png" 
              alt="Rate limit warning"
              style={{ width: '100%', maxWidth: '450px' }}
            />
            <div className={styles.modalContent}>
              <h3>Rate Limit Exceeded</h3>
              <p>Endpoint: {rateLimitInfo.endpoint}</p>
              <p>Remaining: {Math.max(0, rateLimitInfo.remaining)}/10</p>
              <button 
                onClick={() => setShowRateLimitModal(false)}
                className={styles.modalButton}
              >
                OK
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}