'use client';

import React from 'react';
import { BaseModal } from './BaseModal';
import { useModalStore } from '@store/modalStore';
import type { ModalMap } from '@store/modalStore';
import styles from './modals.module.css';

export function ErrorModal() {
  const { open, payload, closeModal } = useModalStore();
  const isOpen = open === 'error';

  // If the modal isn't the error modal or there's no payload, nothing to render
  if (open !== 'error' || !payload) return null;

  // payload may be any ModalMap entry — narrow safely to error payload
  const maybeErrorPayload = payload as ModalMap['error'] | undefined;
  const error = maybeErrorPayload?.error;

  // If payload exists but doesn't contain an `error`, bail out (keeps previous behavior)
  if (!error) return null;

  // Robust-ish JWT/401 detection from message/details if present (no hooks; avoid conditional hook call)
  const rawMsg = String(error?.message ?? '');
  const details = String(error?.details ?? '');
  const text = `${rawMsg} ${details}`.toLowerCase();
  const isJwtError = /unauthoriz|jwt|token|bearer|401/.test(text);

  return (
    <BaseModal isOpen={isOpen} className={styles.errorModal} onClose={closeModal}>
      <div className={styles.errorModalContent}>
        <h2 className={styles.errorTitle}>Error Occurred</h2>

        <div className={styles.errorScrollArea}>
          <p className={styles.errorMessage}>{error.message}</p>

          {isJwtError && (
            <p className={styles.errorMessage}>
              Refresh the page and sign back in to get a new one.
            </p>
          )}

          {error.details && (
            <pre className={styles.errorDetails}>{error.details}</pre>
          )}
        </div>

        <div className={styles.errorFooter}>
          {isJwtError ? (
            <>
              <button
                className={styles.retryButton}
                onClick={() => {
                  try {
                    // Ensure modal closes before navigating
                    closeModal();
                  } finally {
                    window.location.reload();
                  }
                }}
              >
                Refresh
              </button>
              <button className={styles.dismissButton} onClick={closeModal}>
                Dismiss
              </button>
            </>
          ) : (
            <>
              {error.retry && (
                <button
                  className={styles.retryButton}
                  onClick={() => {
                    // call the retry function if provided, then close modal
                    try {
                      error.retry?.();
                    } finally {
                      closeModal();
                    }
                  }}
                >
                  Retry
                </button>
              )}
              <button className={styles.dismissButton} onClick={closeModal}>
                Dismiss
              </button>
            </>
          )}
        </div>
      </div>
    </BaseModal>
  );
}
