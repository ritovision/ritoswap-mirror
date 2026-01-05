// app/gate/components/Completion/Completion.tsx
"use client"
import React from 'react'
import styles from './Completion.module.css'

export default function Completion() {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Message Successfully Sent</h2>
      <p className={styles.message}>
        Your Key has been used and cannot be used again.
      </p>
    </div>
  )
}