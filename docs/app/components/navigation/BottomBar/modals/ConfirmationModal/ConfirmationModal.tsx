'use client'

import styles from './ConfirmationModal.module.css'

interface ConfirmationModalProps {
  isOpen: boolean
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmationModal({
  isOpen,
  message,
  confirmText = 'Yes',
  cancelText = 'Cancel',
  onConfirm,
  onCancel
}: ConfirmationModalProps) {
  if (!isOpen) return null

  return (
    <>
      <div className={styles.confirmOverlay} onClick={onCancel} />
      <div className={styles.confirmModal}>
        <p className={styles.confirmMessage}>{message}</p>
        <div className={styles.confirmButtons}>
          <button
            className={`${styles.confirmButton} ${styles.confirmButtonPrimary}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
          <button
            className={`${styles.confirmButton} ${styles.cancelButton}`}
            onClick={onCancel}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </>
  )
}
