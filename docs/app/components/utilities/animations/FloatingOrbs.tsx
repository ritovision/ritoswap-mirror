'use client'

import React from 'react'
import styles from './FloatingOrbs.module.css'

type FloatingOrbsProps = {
  className?: string
  zIndex?: number
}

export default function FloatingOrbs({
  className,
  zIndex = 0,
}: FloatingOrbsProps) {
  return (
    <div
      className={[styles.FloatingOrbs, className].filter(Boolean).join(' ')}
      style={{ zIndex }}
      aria-hidden
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className={styles.orb} />
      ))}
    </div>
  )
}
