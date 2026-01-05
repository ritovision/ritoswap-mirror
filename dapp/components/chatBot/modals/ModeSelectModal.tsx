// dapp/components/chatBot/modals/ModeSelectModal.tsx
'use client';

import React from 'react';
import { BaseModal } from './BaseModal';
import { useModalStore } from '@store/modalStore';
import { useChatModeStore } from '@store/chatModeStore';
import { modeConfigs } from '@lib/llm/modes/configs';
import styles from './modals.module.css';

export function ModeSelectModal() {
  const { open, openModal, closeModal } = useModalStore();
  const { setMode } = useChatModeStore();
  
  const isOpen = open === 'mode';

  const handleSelectMode = (mode: 'rapBattle' | 'freestyle' | 'agentBattle') => {
    // For battle modes, open the form first
    if (mode === 'rapBattle' || mode === 'agentBattle') {
      openModal('battleForm', { battleMode: mode });
      return;
    }
    
    // For other modes, directly set and close
    setMode(mode, 'user');
    closeModal();
  };

  return (
    <BaseModal isOpen={isOpen} className={styles.modeSelectModal}>
      <h2 className={styles.modalTitle}>Choose Your Chat Mode</h2>
      <div className={styles.modeGrid}>
        {Object.values(modeConfigs).map((config) => (
          <button
            key={config.id}
            className={styles.modeButton}
            onClick={() => handleSelectMode(config.id as 'rapBattle' | 'freestyle' | 'agentBattle')}
          >
            <span className={styles.modeButtonTitle}>{config.title}</span>
            {config.description && (
              <span className={styles.modeButtonDesc}>{config.description}</span>
            )}
          </button>
        ))}
      </div>
    </BaseModal>
  );
}