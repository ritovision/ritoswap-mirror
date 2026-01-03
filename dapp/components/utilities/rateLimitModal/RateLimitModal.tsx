// components/utilities/wallet/rateLimitModal/RateLimitModal.tsx
"use client"
import React, { useEffect, useState, useRef } from 'react'
import styles from './RateLimitModal.module.css'

interface RateLimitModalProps {
  isVisible: boolean
  limit?: number
  remaining?: number
  retryAfter?: number
  autoDismiss?: boolean
  onClose?: () => void
}

let modalInstance: { show: (props: Omit<RateLimitModalProps, 'isVisible'>) => void } | null = null

export default function RateLimitModal({
  isVisible,
  limit,
  remaining,
  retryAfter,
  autoDismiss = true,
  onClose
}: RateLimitModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = modalRef.current
    if (!el) return

    // Reset visibility each time we become visible
    if (isVisible) {
      // Ensure it's discoverable by Testing Library initially
      el.style.removeProperty('display')
      el.classList.remove(styles.fadeIn, styles.fadeOut)
      el.classList.add(styles.fadeIn)

      let fadeOutTimer: number | undefined
      let closeTimer: number | undefined

      if (autoDismiss) {
        // Start fade-out after 3s
        fadeOutTimer = window.setTimeout(() => {
          el.classList.remove(styles.fadeIn)
          el.classList.add(styles.fadeOut)

          // After animation (~300ms), hide from a11y tree and call onClose
          closeTimer = window.setTimeout(() => {
            // Hide without React state so queries by role return null
            el.style.display = 'none'
            onClose?.()
          }, 300)
        }, 3000)
      }

      return () => {
        if (fadeOutTimer) window.clearTimeout(fadeOutTimer)
        if (closeTimer) window.clearTimeout(closeTimer)
        el.classList.remove(styles.fadeIn, styles.fadeOut)
      }
    } else {
      // If externally hidden, ensure no stale classes linger
      el.classList.remove(styles.fadeIn, styles.fadeOut)
      el.style.display = 'none'
    }
  }, [isVisible, autoDismiss, onClose])

  // Keep markup in the tree while visible is true; we manage visibility via style for tests.
  if (!isVisible) return null

  return (
    <div ref={modalRef} className={styles.modal}>
      <div className={styles.content}>
        <h3 className={styles.title}>Too Many Requests</h3>
        <p className={styles.message}>
          {remaining === 0
            ? `Rate limit reached. Please try again ${retryAfter ? `in ${retryAfter} seconds` : 'later'}.`
            : `You have ${remaining} requests remaining.`
          }
        </p>
        {typeof limit === 'number' && (
          <p className={styles.details}>
            Limit: {limit} requests per minute
          </p>
        )}
      </div>
    </div>
  )
}

// Singleton instance management
export function showRateLimitModal(props: Omit<RateLimitModalProps, 'isVisible'>) {
  if (modalInstance) {
    modalInstance.show(props)
  }
}

// Provider component to manage singleton
export function RateLimitModalProvider({ children }: { children: React.ReactNode }) {
  const [modalProps, setModalProps] = useState<Omit<RateLimitModalProps, 'isVisible'> | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [modalKey, setModalKey] = useState(0)
  const showTimerRef = useRef<number | null>(null)

  useEffect(() => {
    modalInstance = {
      show: (props) => {
        // Clear any existing show timer
        if (showTimerRef.current) {
          window.clearTimeout(showTimerRef.current)
          showTimerRef.current = null
        }

        // Cancel any existing modal and show new one
        setIsVisible(false)
        setModalKey(prev => prev + 1) // Force remount

        // Small delay to ensure clean transition
        showTimerRef.current = window.setTimeout(() => {
          setModalProps(props)
          setIsVisible(true)
        }, 100)
      }
    }

    // Cleanup on unmount
    return () => {
      modalInstance = null
      if (showTimerRef.current) {
        window.clearTimeout(showTimerRef.current)
        showTimerRef.current = null
      }
    }
  }, [])

  return (
    <>
      {children}
      {modalProps && (
        <RateLimitModal
          key={modalKey}
          isVisible={isVisible}
          {...modalProps}
          onClose={() => {
            setIsVisible(false)
            setModalProps(null)
          }}
        />
      )}
    </>
  )
}
