// docs/app/components/utilities/viewpage/viewpage.tsx
'use client'

import React from 'react'
import styles from './viewpage.module.css'

export interface ViewPageProps {
  mainnetUrl?: string
  testnetUrl?: string
}

/**
 * “View Live Page” + one or two link areas.
 * - Single link → 200px wide, centered
 * - Two links → each 200px, container 400px
 * - Always opens in a new tab
 */
export default function ViewPage({
  mainnetUrl,
  testnetUrl,
}: ViewPageProps) {
  if (!mainnetUrl && !testnetUrl) {
    throw new Error(
      'ViewPage requires at least one of mainnetUrl or testnetUrl'
    )
  }

  const items: { label: string; url: string }[] = []
  if (mainnetUrl) items.push({ label: 'Mainnet', url: mainnetUrl })
  if (testnetUrl) items.push({ label: 'Testnet', url: testnetUrl })

  const single = items.length === 1

  return (
    <div className={styles.wrapper}>
      <div className={styles.title}>View Live Page</div>
      <div
        className={`${styles.container} ${
          single ? styles.single : ''
        }`}
      >
        {items.map(({ label, url }) => (
          <a
            key={label}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.section}
          >
            {label}
          </a>
        ))}
      </div>
    </div>
  )
}
