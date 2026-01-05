/* // app/gate/components/GateModal/GateModal.tsx */
'use client'

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useId,
} from 'react'
import styles from './GateModal.module.css'
import { useAccount, useSignMessage } from 'wagmi'
import { useNFTStore } from '@/app/store/nftStore'
import ConnectWrapper from '@/components/wallet/connectButton/ConnectWrapper'
import ProcessingModal from '@/components/wallet/processingModal/ProcessingModal'
import { isMobileDevice } from '@/app/utils/mobile'
import { openWalletDeeplink } from '@/app/utils/walletDeeplink'
import { isSiweEnabled, createSiweMessage } from '@/app/lib/siwe/siwe.client'
import { showRateLimitModal } from '@/components/utilities/rateLimitModal/RateLimitModal'
import { sendNotificationEvent, sendErrorNotification } from '@/app/lib/notifications'
import { useDappChain } from '@/components/providers/DappChainProvider'
import { publicEnv } from '@config/public.env'
import { getTargetChainId } from '@config/chain'

import {
  gateApi,
  nonceApi,
  normalizeHost,
  hasRateLimitInfo,
  isErrorResponse,
} from '@/app/lib/client'
import type {
  GateAccessLegacyRequestDTO,
  GateAccessSiweRequestDTO,
  GatedContent,
} from '@/app/lib/client'

import {
  clearStoredToken,
  getStoredToken,
  setStoredToken,
  isExpired as isJwtExpired,
} from '@/app/lib/jwt/client'

/** Lightweight helpers */
type AccessTokenContainer = { accessToken?: unknown }
function getErrorName(e: unknown): string | undefined {
  if (typeof e === 'object' && e !== null && 'name' in e) {
    const n = (e as { name?: unknown }).name
    return typeof n === 'string' ? n : undefined
  }
  return undefined
}
function isAbortError(err: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError') ||
    (typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      typeof (err as { name?: unknown }).name === 'string' &&
      (err as { name?: unknown }).name === 'AbortError')
  )
}

/** Local render state */
type RenderState =
  | 'loading'
  | 'not-connected'
  | 'no-nft'
  | 'has-unused-nft'
  | 'has-used-nft'

interface GateModalProps {
  onUnlock: () => void
  isAnimating: boolean
  onContentReceived?: (content: GatedContent) => void
}

/** Env → domain allowlist */
function getAllowedDomainsFromEnv(): string[] {
  const env = publicEnv.NEXT_PUBLIC_DOMAIN
  if (!env) return []
  return Array.from(
    new Set(
      env
        .split(',')
        .map((s) => normalizeHost(s))
        .filter((s): s is string => !!s)
    )
  )
}

/** Parse basic RL headers (fallback when body isn’t JSON) */
function readRateLimitFromHeaders(res: Response) {
  const limit = res.headers.get('X-RateLimit-Limit')
  const remaining = res.headers.get('X-RateLimit-Remaining')
  const retryAfter = res.headers.get('Retry-After')
  if (limit && remaining && retryAfter) {
    return {
      limit: Number(limit),
      remaining: Number(remaining),
      retryAfter: Number(retryAfter),
    }
  }
  return null
}

export default function GateModal({
  onUnlock,
  isAnimating,
  onContentReceived,
}: GateModalProps) {
  const { isConnected, address, connector } = useAccount()
  const { hasNFT, hasUsedTokenGate, isLoading, tokenId } = useNFTStore()
  const { signMessageAsync } = useSignMessage()
  const { resetToActiveChain } = useDappChain()
  const targetChainId = getTargetChainId()

  const [isHydrated, setIsHydrated] = useState(false)
  const [renderState, setRenderState] = useState<RenderState>('loading')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const modalRef = useRef<HTMLDivElement>(null)

  // a11y ids
  const titleId = useId()
  const errorId = useId()

  /** lifecycle + timers */
  const mountedRef = useRef(true)
  const initTimerRef = useRef<number | null>(null)
  const transitionTimerRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const rAFRef = useRef<number | null>(null)

  /** single-flight + abort management for unlock */
  const inFlightRef = useRef<Promise<void> | null>(null)
  const unlockAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    mountedRef.current = true
    initTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current) setIsHydrated(true)
    }, 50)

    return () => {
      mountedRef.current = false
      if (initTimerRef.current) window.clearTimeout(initTimerRef.current)
      if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current)
      if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current)
      if (rAFRef.current) cancelAnimationFrame(rAFRef.current)
      unlockAbortRef.current?.abort('unmount')
    }
  }, [])

  // Focus mgmt
  useEffect(() => {
    if (!modalRef.current || isAnimating) return
    rAFRef.current = requestAnimationFrame(() => {
      modalRef.current?.focus()
    })
  }, [renderState, isAnimating])

  // Render state transitions
  useEffect(() => {
    if (!isHydrated || isLoading) return

    const nextState: RenderState =
      !isConnected
        ? 'not-connected'
        : !hasNFT
        ? 'no-nft'
        : hasNFT && !hasUsedTokenGate
        ? 'has-unused-nft'
        : 'has-used-nft'

    if (nextState !== renderState && renderState !== 'loading') {
      setIsTransitioning(true)

      if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current)
      if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current)

      transitionTimerRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return
        setRenderState(nextState)

        settleTimerRef.current = window.setTimeout(() => {
          if (mountedRef.current) setIsTransitioning(false)
        }, 50)
      }, 300)
    } else if (renderState === 'loading') {
      setRenderState(nextState)
    }
  }, [isConnected, hasNFT, hasUsedTokenGate, isHydrated, renderState, isLoading])

  /** tiny readiness wait to avoid first-paint races */
  const waitForReady = useCallback(async (ms = 1200) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      const ready =
        mountedRef.current &&
        isConnected &&
        !!address &&
        tokenId !== null &&
        !isLoading
      if (ready) return
      await new Promise((r) => setTimeout(r, 50))
    }
  }, [isConnected, address, tokenId, isLoading])

  /**
   * Unlock flow (single-flight, abort-safe):
   * 1) Try JWT (Authorization) path.
   * 2) If SIWE enabled → SIWE; else legacy message.
   */
  const handleUnlockClick = useCallback(async () => {
    if (!address || tokenId === null) {
      sendErrorNotification('Connection error. Please refresh and try again.')
      return
    }

    // single-flight: if an attempt is running, just reuse it
    if (inFlightRef.current) return inFlightRef.current

    // Reset dapp chain to active chain before signing
    resetToActiveChain()

    setIsSigning(true)
    setErrorMessage(null)

    const ac = new AbortController()
    unlockAbortRef.current = ac
    const { signal } = ac

    const p = (async () => {
      try {
        await waitForReady()

        /** JWT-first */
        const tryJwtFirst = async (): Promise<boolean> => {
          const token = getStoredToken()
          if (!token || isJwtExpired(token)) return false

          try {
            const res = await fetch('/api/gate-access', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ tokenId }),
              signal,
            })

            if (res.status === 429) {
              const rl = readRateLimitFromHeaders(res)
              if (rl) showRateLimitModal(rl)
              return true
            }
            if (!res.ok) {
              // Clear invalid JWT so we don't keep retrying it
              if (res.status === 401) {
                clearStoredToken()
              }
              return false
            }

            const data: unknown = await res.json()
            const maybeToken = (data as AccessTokenContainer)?.accessToken
            if (typeof maybeToken === 'string') setStoredToken(maybeToken)
            if (onContentReceived) {
              const maybeContent = (data as { content?: unknown }).content
              if (maybeContent) onContentReceived(maybeContent as unknown as GatedContent)
            }
            onUnlock()
            sendNotificationEvent('GATE_UNLOCKED', { source: 'user' })
            return true
          } catch (e) {
            if (isAbortError(e)) return true /* treat as handled */
            return false
          }
        }

        const jwtHandled = await tryJwtFirst()
        if (jwtHandled) return

        if (isSiweEnabled()) {
          /** ---- SIWE ---- */
          const nonceRes = await nonceApi.fetchNonce()
          if (!nonceRes.ok) {
            if (nonceRes.status === 429) {
              const rl = nonceRes.rateLimit || (hasRateLimitInfo(nonceRes.error) ? nonceRes.error : undefined)
              if (rl) showRateLimitModal(rl)
              return
            }
            const msg = isErrorResponse(nonceRes.error) ? nonceRes.error.error : 'Failed to get nonce'
            sendErrorNotification(msg)
            return
          }

          const { nonce } = nonceRes.data
          const message = createSiweMessage({
            address,
            nonce,
            statement: `Sign in to access token gate with key #${tokenId}`,
          })

          const sigPromise = signMessageAsync({ message })
          if (isMobileDevice() && connector?.id === 'walletConnect') openWalletDeeplink()
          const signature = await sigPromise

          const payload: GateAccessSiweRequestDTO = {
            address,
            signature: signature as `0x${string}`,
            tokenId,
            message,
            nonce,
          }

          const result = await gateApi.requestGateAccess(payload, { signal })
          if (result.ok) {
            const maybeToken = (result.data as unknown as AccessTokenContainer)?.accessToken
            if (typeof maybeToken === 'string') setStoredToken(maybeToken)
            if (onContentReceived) {
              const maybeContent = (result.data as { content?: unknown }).content
              if (maybeContent) onContentReceived(maybeContent as unknown as GatedContent)
            }
            onUnlock()
            sendNotificationEvent('GATE_UNLOCKED', { source: 'user' })
          } else {
            if (result.status === 429) {
              const rl = result.rateLimit || (hasRateLimitInfo(result.error) ? result.error : undefined)
              if (rl) showRateLimitModal(rl)
              return
            }
            const errMsg = isErrorResponse(result.error) ? result.error.error : 'Failed to verify access'
            setErrorMessage(errMsg)
            sendErrorNotification(errMsg)
          }
          return
        }

        /** ---- Legacy ---- */
        const allowedDomains = getAllowedDomainsFromEnv()
        if (allowedDomains.length === 0) {
          sendErrorNotification('App misconfiguration: NEXT_PUBLIC_DOMAIN is not set')
          throw new Error('NEXT_PUBLIC_DOMAIN not configured')
        }

        const currentHost = normalizeHost(typeof window !== 'undefined' ? window.location.host : '')
        const domain = allowedDomains.includes(currentHost) ? currentHost : allowedDomains[0]
        const chainId = targetChainId
        const timestamp = Date.now()
        const path = '/api/gate-access'
        const method = 'POST'

        const message = [
          `I own key #${tokenId}`,
          `Domain: ${domain}`,
          `Path: ${path}`,
          `Method: ${method}`,
          `ChainId: ${chainId}`,
          `Timestamp: ${timestamp}`,
        ].join('\n')

        const sigPromise = signMessageAsync({ message })
        if (isMobileDevice() && connector?.id === 'walletConnect') openWalletDeeplink()
        const signature = await sigPromise

        const payload: GateAccessLegacyRequestDTO = {
          address,
          signature: signature as `0x${string}`,
          tokenId,
          timestamp,
        }

        const result = await gateApi.requestGateAccess(payload, { signal })
        if (result.ok) {
          const maybeToken = (result.data as unknown as AccessTokenContainer)?.accessToken
          if (typeof maybeToken === 'string') setStoredToken(maybeToken)
          if (onContentReceived) {
            const maybeContent = (result.data as { content?: unknown }).content
            if (maybeContent) onContentReceived(maybeContent as unknown as GatedContent)
          }
          onUnlock()
          sendNotificationEvent('GATE_UNLOCKED', { source: 'user' })
        } else {
          if (result.status === 429) {
            const rl = result.rateLimit || (hasRateLimitInfo(result.error) ? result.error : undefined)
            if (rl) showRateLimitModal(rl)
            return
          }
          const errMsg = isErrorResponse(result.error) ? result.error.error : 'Failed to verify access'
          setErrorMessage(errMsg)
          sendErrorNotification(errMsg)
        }
      } catch (error: unknown) {
        const name = getErrorName(error)
        if (isAbortError(error)) {
          /* ignore aborted attempt */
        } else if (name === 'UserRejectedRequestError') {
          if (mountedRef.current) setErrorMessage('Signature request cancelled')
          sendNotificationEvent('TRANSACTION_CANCELLED')
        } else {
          if (mountedRef.current) setErrorMessage('Failed to verify access. Please try again.')
          sendErrorNotification('Failed to verify access. Please try again.')
        }
        console.error('Unlock error:', error)
      } finally {
        if (mountedRef.current) setIsSigning(false)
      }
    })()

    inFlightRef.current = p
    try {
      await p
    } finally {
      if (inFlightRef.current === p) inFlightRef.current = null
    }
  }, [
    address,
    tokenId,
    connector?.id,
    onContentReceived,
    onUnlock,
    signMessageAsync,
    targetChainId,
    waitForReady,
    resetToActiveChain,
  ])

  const handleModalCancel = useCallback(() => {
    setIsSigning(false)
    unlockAbortRef.current?.abort('user-cancel')
  }, [])

  /** Render */
  if (!isHydrated || renderState === 'loading') {
    return (
      <div
        className={`${styles.modal} ${isAnimating ? styles.animating : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy="true"
        ref={modalRef}
        tabIndex={-1}
      >
        <div className={styles.content}>
          <h2 id={titleId} className={styles.title}>
            Loading...
          </h2>
        </div>
      </div>
    )
  }

  const renderContent = () => {
    switch (renderState) {
      case 'not-connected':
        return (
          <>
            <h2
              id={titleId}
              className={`${styles.title} ${isTransitioning ? styles.transitioning : ''}`}
            >
              You are not signed in
            </h2>
            <div
              className={`${styles.buttonContainer} ${isTransitioning ? styles.transitioning : ''}`}
              role="group"
              aria-label="Wallet connection"
            >
              <ConnectWrapper />
            </div>
          </>
        )
      case 'no-nft':
        return (
          <>
            <h2
              id={titleId}
              className={`${styles.title} ${isTransitioning ? styles.transitioning : ''}`}
            >
              Access Restricted. You need a key to enter.
            </h2>
            <div
              className={`${styles.buttonContainer} ${isTransitioning ? styles.transitioning : ''}`}
              role="group"
              aria-label="Get access key"
            >
              <a
                href="/mint"
                className={styles.getKeyButton}
                aria-label="Get an access key to enter the token gate"
              >
                Get Key
              </a>
            </div>
          </>
        )
      case 'has-unused-nft':
        return (
          <>
            <h2
              id={titleId}
              className={`${styles.title} ${isTransitioning ? styles.transitioning : ''}`}
            >
              Welcome to the RitoSwap Token Gate
            </h2>
            {errorMessage && (
              <p id={errorId} className={styles.errorMessage} role="alert" aria-live="polite">
                {errorMessage}
              </p>
            )}
            <div
              className={`${styles.buttonContainer} ${isTransitioning ? styles.transitioning : ''}`}
              role="group"
              aria-label="Gate access"
            >
              <button
                className={styles.unlockButton}
                onClick={handleUnlockClick}
                disabled={isAnimating || isSigning || !!inFlightRef.current}
                aria-label={
                  isSigning
                    ? 'Signing in progress'
                    : isAnimating
                    ? 'Unlocking gate'
                    : 'Sign message to unlock the token gate'
                }
                aria-describedby={errorMessage ? errorId : undefined}
                aria-busy={isSigning || isAnimating || !!inFlightRef.current}
              >
                {isSigning ? 'Signing...' : isAnimating ? 'Unlocking...' : 'Sign & Unlock'}
              </button>
            </div>
          </>
        )
      case 'has-used-nft':
        return (
          <>
            <h2
              id={titleId}
              className={`${styles.title} ${isTransitioning ? styles.transitioning : ''}`}
            >
              Your key has already been used. Please burn it and get a new one to unlock this area.
            </h2>
            <div
              className={`${styles.buttonContainer} ${isTransitioning ? styles.transitioning : ''}`}
              role="group"
              aria-label="Get new access key"
            >
              <a
                href="/mint"
                className={styles.getKeyButton}
                aria-label="Get a new access key to replace your used key"
              >
                Get New Key
              </a>
            </div>
          </>
        )
      default:
        return null
    }
  }

  return (
    <>
      <div
        className={`${styles.modal} ${isAnimating ? styles.animating : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={isTransitioning || isSigning || isAnimating || !!inFlightRef.current}
        ref={modalRef}
        tabIndex={-1}
      >
        <div className={styles.content}>{renderContent()}</div>
      </div>

      <div className={styles.modalWrapper} style={{ top: '15%' }}>
        <ProcessingModal
          isVisible={isSigning}
          onCancel={handleModalCancel}
          aria-label="Processing signature request"
        />
      </div>
    </>
  )
}
