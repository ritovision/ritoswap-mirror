// app/hooks/useMintBurn.ts
"use client"
import { useEffect, useCallback, useRef } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { sendNotificationEvent, sendErrorNotification } from '@/app/lib/notifications'
import { isMobileDevice } from '@/app/utils/mobile'
import { openWalletDeeplink } from '@/app/utils/walletDeeplink'
import { useDappChain } from '@/components/providers/DappChainProvider'
import {
  createMintAction,
  createBurnAction,
  formatMintError,
  formatBurnError,
} from '@lib/client/mint.client'

export interface UseMintBurnOptions {
  onMintSuccess?: () => Promise<void> | void
  onBurnSuccess?: () => Promise<void> | void
  onMintError?: (error: Error) => void
  onBurnError?: (error: Error) => void
  autoRefresh?: boolean
  notificationDelay?: number
}

export interface UseMintBurnReturn {
  // Actions
  mint: () => void
  burn: (tokenId: string | number | null) => void

  // States
  isProcessing: boolean
  isMinting: boolean
  isBurning: boolean
  isMintConfirming: boolean
  isBurnConfirming: boolean

  // Transaction hashes
  mintHash: `0x${string}` | undefined
  burnHash: `0x${string}` | undefined

  // Success states
  isMintSuccess: boolean
  isBurnSuccess: boolean

  // Error states
  mintError: Error | null
  burnError: Error | null

  // Reset functions
  resetMint: () => void
  resetBurn: () => void
  resetAll: () => void
}

export function useMintBurn(options: UseMintBurnOptions = {}): UseMintBurnReturn {
  const {
    onMintSuccess,
    onBurnSuccess,
    onMintError,
    onBurnError,
    notificationDelay = 100,
  } = options

  const { connector } = useAccount()
  const { resetToActiveChain } = useDappChain()

  // Track processed hashes to prevent duplicate notifications
  const lastMintHashRef = useRef<string | null>(null)
  const lastBurnHashRef = useRef<string | null>(null)

  // Mint contract interaction
  const {
    writeContract: mintContract,
    data: mintHash,
    isPending: isMinting,
    error: mintError,
    reset: resetMint,
  } = useWriteContract()

  // Burn contract interaction
  const {
    writeContract: burnContract,
    data: burnHash,
    isPending: isBurning,
    error: burnError,
    reset: resetBurn,
  } = useWriteContract()

  // Stable refs for changing identities (wagmi returns new fns each render)
  const resetMintRef = useRef(resetMint)
  const resetBurnRef = useRef(resetBurn)
  const onMintSuccessRef = useRef(onMintSuccess)
  const onBurnSuccessRef = useRef(onBurnSuccess)

  useEffect(() => { resetMintRef.current = resetMint }, [resetMint])
  useEffect(() => { resetBurnRef.current = resetBurn }, [resetBurn])
  useEffect(() => { onMintSuccessRef.current = onMintSuccess }, [onMintSuccess])
  useEffect(() => { onBurnSuccessRef.current = onBurnSuccess }, [onBurnSuccess])

  // Wait for transaction confirmations
  const {
    isLoading: isMintConfirming,
    isSuccess: isMintSuccess,
  } = useWaitForTransactionReceipt({
    hash: mintHash,
    query: { enabled: !!mintHash },
  })

  const {
    isLoading: isBurnConfirming,
    isSuccess: isBurnSuccess,
  } = useWaitForTransactionReceipt({
    hash: burnHash,
    query: { enabled: !!burnHash },
  })

  // Handle mint errors
  useEffect(() => {
    if (mintError) {
      formatMintError(mintError)
      // formatMintError already sends the appropriate notification
      onMintError?.(mintError)
      resetMintRef.current()
    }
  }, [mintError, onMintError])

  // Handle burn errors
  useEffect(() => {
    if (burnError) {
      formatBurnError(burnError)
      // formatBurnError already sends the appropriate notification
      onBurnError?.(burnError)
      resetBurnRef.current()
    }
  }, [burnError, onBurnError])

  // Handle mint success
  useEffect(() => {
    if (isMintSuccess && mintHash && mintHash !== lastMintHashRef.current) {
      lastMintHashRef.current = mintHash
      console.log('Mint transaction:', mintHash)

      // Send notification only once
      const notificationTimer = setTimeout(() => {
        sendNotificationEvent('NFT_MINTED', { source: 'user' })
      }, notificationDelay)

      const callbackTimer = setTimeout(async () => {
        await onMintSuccessRef.current?.()
        resetMintRef.current()
      }, 2000)

      return () => {
        clearTimeout(notificationTimer)
        clearTimeout(callbackTimer)
      }
    }
    // intentionally NOT depending on lastMintHashRef/resetMint/onMintSuccess identities
  }, [isMintSuccess, mintHash, notificationDelay])

  // Handle burn success
  useEffect(() => {
    if (isBurnSuccess && burnHash && burnHash !== lastBurnHashRef.current) {
      lastBurnHashRef.current = burnHash
      console.log('Burn transaction:', burnHash)

      // Send notification only once
      const notificationTimer = setTimeout(() => {
        sendNotificationEvent('NFT_BURNED', { source: 'user' })
      }, notificationDelay)

      const callbackTimer = setTimeout(async () => {
        await onBurnSuccessRef.current?.()
        resetBurnRef.current()
      }, 2000)

      return () => {
        clearTimeout(notificationTimer)
        clearTimeout(callbackTimer)
      }
    }
    // intentionally NOT depending on lastBurnHashRef/resetBurn/onBurnSuccess identities
  }, [isBurnSuccess, burnHash, notificationDelay])

  // Action: Mint NFT
  const mint = useCallback(() => {
    resetToActiveChain()
    const action = createMintAction()
    mintContract(action)
    if (isMobileDevice() && connector?.id === 'walletConnect') openWalletDeeplink()
  }, [mintContract, connector, resetToActiveChain])

  // Action: Burn NFT
  const burn = useCallback((tokenId: string | number | null) => {
    if (!tokenId || (typeof tokenId === 'string' && tokenId === '')) {
      sendErrorNotification('No token ID available for burning')
      return
    }
    resetToActiveChain()
    const action = createBurnAction(tokenId as string | number)
    burnContract(action)
    if (isMobileDevice() && connector?.id === 'walletConnect') openWalletDeeplink()
  }, [burnContract, connector, resetToActiveChain])

  // Reset all states
  const resetAll = useCallback(() => {
    resetMintRef.current()
    resetBurnRef.current()
    lastMintHashRef.current = null
    lastBurnHashRef.current = null
  }, [])

  const resetMintFn = useCallback(() => {
    resetMintRef.current?.()
  }, [])

  const resetBurnFn = useCallback(() => {
    resetBurnRef.current?.()
  }, [])

  const isProcessing = isMinting || isBurning || isMintConfirming || isBurnConfirming

  return {
    // Actions
    mint,
    burn,

    // States
    isProcessing,
    isMinting,
    isBurning,
    isMintConfirming,
    isBurnConfirming,

    // Transaction hashes
    mintHash,
    burnHash,

    // Success states
    isMintSuccess,
    isBurnSuccess,

    // Error states
    mintError,
    burnError,

    // Reset functions
    resetMint: resetMintFn,
    resetBurn: resetBurnFn,
    resetAll,
  }
}
