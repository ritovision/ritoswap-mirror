'use client'

import { useRouter } from 'next/navigation'
import ErrorShellFullPage from './ErrorShellFullPage'

type PageErrorProps = {
  title?: string
  message?: string
  reset?: () => void
  homeHref?: string
}

export default function PageError({
  title = 'Docs hit a snag',
  message = 'Something went wrong while loading this page. Try again or head back to the docs home.',
  reset,
  homeHref = '/',
}: PageErrorProps) {
  const router = useRouter()

  return (
    <ErrorShellFullPage
      eyebrow="RitoSwap Docs"
      title={title}
      body={message}
      actions={[
        ...(reset
          ? [
              {
                label: 'Try again',
                onClick: () => reset(),
                variant: 'primary' as const,
              },
            ]
          : []),
        {
          label: 'Back to docs',
          href: homeHref,
          variant: reset ? 'secondary' : 'primary',
        },
        {
          label: 'Reload page',
          onClick: () => router.refresh(),
          variant: 'secondary',
        },
      ]}
    />
  )
}
