'use client'

import type { ReactNode } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import PageError from './PageError'

type DocsErrorBoundaryProps = {
  children: ReactNode
}

export default function DocsErrorBoundary({ children }: DocsErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallbackRender={({ resetErrorBoundary }) => <PageError reset={resetErrorBoundary} />}
      onError={(error) => {
        console.error('Docs client error boundary caught an error', error)
      }}
    >
      {children}
    </ErrorBoundary>
  )
}
