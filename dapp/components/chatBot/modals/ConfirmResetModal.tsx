// dapp/components/utilities/chatBot/modals/ConfirmResetModal.tsx
'use client';

import React from 'react';
import { BaseModal } from './BaseModal';
import { useModalStore } from '@store/modalStore';
import styles from './modals.module.css';

interface ConfirmResetModalProps {
  onConfirm: () => void;
}

export function ConfirmResetModal({ onConfirm }: ConfirmResetModalProps) {
  const { open, closeModal } = useModalStore();
  
  const isOpen = open === 'confirmReset';

  const handleDelete = () => {
    onConfirm();
    closeModal();
  };

  return (
    <BaseModal isOpen={isOpen} className={styles.confirmModal} onClose={closeModal}>
      <h2 className={styles.confirmTitle}>Delete Conversation?</h2>
      <p className={styles.confirmText}>
        Are you sure you want to delete this conversation and start over?
      </p>
      <div className={styles.confirmButtons}>
        <button className={styles.deleteButton} onClick={handleDelete} data-testid="confirm-delete-button">
          Delete
        </button>
        <button className={styles.cancelButton} onClick={closeModal}>
          Cancel
        </button>
      </div>
    </BaseModal>
  );
}