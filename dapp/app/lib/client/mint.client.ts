// app/lib/client/mint.client.ts
"use client"
import { fullKeyTokenAbi, KEY_TOKEN_ADDRESS } from '@config/contracts'
import { getTargetChainId } from '@config/chain'
import { sendNotificationEvent, sendErrorNotification } from '@lib/notifications'
import type { WriteContractParameters } from 'wagmi/actions'

// Contract action creators - always target the app's configured chain
export const createMintAction = (): WriteContractParameters => ({
  address: KEY_TOKEN_ADDRESS,
  abi: fullKeyTokenAbi,
  functionName: 'mint',
  chainId: getTargetChainId(),
})

export const createBurnAction = (tokenId: string | number): WriteContractParameters => ({
  address: KEY_TOKEN_ADDRESS,
  abi: fullKeyTokenAbi,
  functionName: 'burn',
  args: [BigInt(tokenId)],
  chainId: getTargetChainId(),
})

// Error message formatters
export const formatMintError = (error: Error): string => {
  if (error.message?.includes('user rejected')) {
    sendNotificationEvent('TRANSACTION_CANCELLED')
    return 'Transaction cancelled'
  }
  if (error.message?.includes('insufficient funds')) {
    sendNotificationEvent('INSUFFICIENT_FUNDS')
    return 'Insufficient funds for minting'
  }
  if (error.message?.includes('already minted')) {
    sendNotificationEvent('ALREADY_MINTED')
    return 'You already own an NFT'
  }
  sendErrorNotification(`Failed to mint NFT: ${error.message}`)
  return `Failed to mint NFT: ${error.message}`
}

export const formatBurnError = (error: Error): string => {
  if (error.message?.includes('user rejected')) {
    sendNotificationEvent('TRANSACTION_CANCELLED')
    return 'Transaction cancelled'
  }
  if (error.message?.includes('not owner')) {
    sendNotificationEvent('NOT_TOKEN_OWNER')
    return 'You are not the owner of this NFT'
  }
  if (error.message?.includes('token does not exist')) {
    sendErrorNotification('Token does not exist')
    return 'Token does not exist'
  }
  sendErrorNotification(`Failed to burn NFT: ${error.message}`)
  return `Failed to burn NFT: ${error.message}`
}

// Transaction success handlers
// Note: Notifications are handled by the useMintBurn hook to avoid duplicates
export const handleMintSuccess = (hash: string): void => {
  console.log('Mint transaction:', hash)
}

export const handleBurnSuccess = (hash: string): void => {
  console.log('Burn transaction:', hash)
}

// Validation utilities
export const validateTokenId = (tokenId: string | number | null): boolean => {
  if (!tokenId) {
    sendErrorNotification('No token ID available for burning')
    return false
  }
  try {
    BigInt(tokenId)
    return true
  } catch {
    sendNotificationEvent('INVALID_TOKEN_ID')
    return false
  }
}

// Transaction status helpers
export interface TransactionStatus {
  isPending: boolean
  isConfirming: boolean
  isSuccess: boolean
  isError: boolean
  hash?: `0x${string}`
}

export const getTransactionStatus = (
  isPending: boolean,
  isConfirming: boolean,
  isSuccess: boolean,
  error?: Error | null
): TransactionStatus => ({
  isPending,
  isConfirming,
  isSuccess,
  isError: !!error,
  hash: undefined,
})

// Retry configuration
export const TRANSACTION_RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  confirmationBlocks: 2,
  confirmationTimeout: 60000, // 60 seconds
}

// Gas estimation helpers
export const estimateGasBuffer = (estimatedGas: bigint): bigint => {
  // Add 20% buffer to gas estimate
  return (estimatedGas * BigInt(120)) / BigInt(100)
}