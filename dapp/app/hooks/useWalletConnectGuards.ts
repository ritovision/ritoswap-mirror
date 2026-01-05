// app/hooks/useWalletConnectGuards.ts

import { useEffect } from 'react'

// Blacklisted wallet domains that auto-redirect
const BLACKLISTED_DOMAINS = [
  'onekey.so',
  'zerion.io',
  'rainbow.me',
  'argent.xyz',
  'trust.com',
  'crypto.com',
  'ledger.com',
]

// Minimal event shape to avoid `any`
type BeforeUnloadWithDestination = BeforeUnloadEvent & {
  destination?: { url?: string }
}

function isBlacklistedUri(uri: string): boolean {
  return BLACKLISTED_DOMAINS.some((domain) => uri.includes(domain))
}

/**
 * Global navigation/popup guards for some walletconnect-related redirects.
 * This does not manage any WalletConnect session state.
 */
export function useWalletConnectGuards(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return

    const preventRedirect = (e: BeforeUnloadEvent) => {
      // Only on mobile Chrome
      if (!/Android.*Chrome/.test(navigator.userAgent)) return

      const destination = (e as BeforeUnloadWithDestination).destination?.url || ''
      if (isBlacklistedUri(destination)) {
        e.preventDefault()
        e.returnValue = ''
        console.log('Blocked redirect to:', destination)
        return false
      }
    }

    // Block popups from WalletConnect
    const originalOpen = window.open
    window.open = function (...args) {
      const url = args[0]?.toString() || ''

      if (isBlacklistedUri(url)) {
        console.log('Blocked popup:', url)
        return null
      }

      // Block http/https URIs on mobile
      if (
        /Android.*Chrome/.test(navigator.userAgent) &&
        (url.startsWith('http://') || url.startsWith('https://'))
      ) {
        console.log('Blocked HTTP redirect on mobile:', url)
        return null
      }

      return originalOpen.apply(window, args as unknown as [string, string?, string?])
    }

    window.addEventListener('beforeunload', preventRedirect)

    return () => {
      window.removeEventListener('beforeunload', preventRedirect)
      window.open = originalOpen
    }
  }, [enabled])
}

