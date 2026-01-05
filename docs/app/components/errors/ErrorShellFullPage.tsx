'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import FloatingOrbs from '../utilities/animations/FloatingOrbs'
import styles from './ErrorShell.module.css'

type Action =
  | { label: string; onClick: () => void; variant?: 'primary' | 'secondary' }
  | { label: string; href: string; variant?: 'primary' | 'secondary' }

type ErrorShellFullPageProps = {
  eyebrow?: string
  title: string
  body?: ReactNode
  actions?: Action[]
}

export default function ErrorShellFullPage({
  eyebrow = 'Something went wrong',
  title,
  body,
  actions = [],
}: ErrorShellFullPageProps) {
  return (
    <div className={styles.page}>
      <div className={styles.orbLayer}>
        <FloatingOrbs />
      </div>
      <div className={styles.orbLayer} style={{ opacity: 0.4 }}>
        <FloatingOrbs zIndex={-1} />
      </div>
      <div className={styles.card}>
        <div className={styles.content}>
          <div className={styles.eyebrow}>{eyebrow}</div>
          <h1 className={styles.heading}>{title}</h1>
          {body && <p className={styles.body}>{body}</p>}
          {actions.length > 0 ? (
            <div className={styles.buttons}>
              {actions.map((action, idx) => {
                const variant = action.variant ?? (idx === 0 ? 'primary' : 'secondary')
                const className = variant === 'primary' ? styles.primary : styles.secondary

                if ('href' in action) {
                  return (
                    <Link key={action.label} href={action.href} className={className}>
                      {action.label}
                    </Link>
                  )
                }

                return (
                  <button
                    key={action.label}
                    type="button"
                    className={className}
                    onClick={action.onClick}
                  >
                    {action.label}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
