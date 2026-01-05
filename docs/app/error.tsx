'use client'

import { useEffect } from 'react'
import PageError from './components/errors/PageError'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Lightweight client-side logging for debugging; no Sentry wiring.
    console.error('Docs route error', error)
  }, [error])

  return <PageError reset={reset} />
}
