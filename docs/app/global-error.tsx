'use client'

import { useEffect } from 'react'
import PageError from './components/errors/PageError'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Docs global error', error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <PageError reset={reset} />
      </body>
    </html>
  )
}
