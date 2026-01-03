'use client'

import type { ReactNode } from 'react'
import styles from './ErrorShell.module.css'

type ErrorShellInlineProps = {
  title?: string
  body?: ReactNode
  action?: ReactNode
}

export default function ErrorShellInline({
  title = 'There was a problem',
  body,
  action,
}: ErrorShellInlineProps) {
  return (
    <div className={styles.inline} role="alert">
      <h3 className={styles.inlineHeading}>{title}</h3>
      {body && <p className={styles.inlineBody}>{body}</p>}
      {action}
    </div>
  )
}
