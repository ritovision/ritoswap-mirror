'use client'

/**
 * Singleton bridge so anything (e.g., LI.FI widget) can open exactly ONE ConnectModal.
 * A single registered opener; safe if called before registration completes.
 */

import { useLayoutEffect } from 'react'

type OpenHandler = () => void

let currentOpener: OpenHandler | null = null
let pendingTimer: ReturnType<typeof setTimeout> | null = null

/** Call this from anywhere (e.g., widget `walletConfig.onConnect`) */
export function openWalletConnectModal(): void {
  const invoke = () => currentOpener?.()

  // If already registered, open immediately.
  if (currentOpener) {
    invoke()
    return
  }

  // If not yet registered (right after mount), queue a short retry.
  if (pendingTimer) return // don't stack multiple timers

  let tries = 5
  const tick = () => {
    if (currentOpener) {
      pendingTimer = null
      invoke()
      return
    }
    if (tries-- > 0) {
      pendingTimer = setTimeout(tick, 0)
    } else {
      // Give up quietly if never registered.
      pendingTimer = null
    }
  }

  pendingTimer = setTimeout(tick, 0)
}

/**
 * Register the ONE opener callback. The most-recent registration wins.
 * Returns an unsubscribe function that unregisters if still current.
 */
export function registerWalletConnectOpener(handler: OpenHandler): () => void {
  currentOpener = handler
  return () => {
    if (currentOpener === handler) currentOpener = null
  }
}

/** React hook to register/unregister the opener from a component. */
export function useRegisterWalletConnectOpener(handler: OpenHandler): void {
  // Layout effect to register synchronously after mount.
  useLayoutEffect(() => {
    const off = registerWalletConnectOpener(handler)
    return off
  }, [handler])
}
