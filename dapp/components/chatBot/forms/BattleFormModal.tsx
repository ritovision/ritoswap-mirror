// dapp/components/chatBot/forms/BattleFormModal.tsx
'use client';

import React from 'react';
import { BaseModal } from '../modals/BaseModal';
import { useModalStore } from '@store/modalStore';
import { useChatModeStore } from '@store/chatModeStore';
import { useAccount, useEnsName, useEnsAvatar } from 'wagmi';
import type { BattleFormData } from './battleFormSchema';
import type { BattlePayload } from '@store/modalStore';
import styles from './battleForm.module.css';

interface FieldConfig {
  key: keyof BattleFormData['user'];
  label: string;
  maxLength: number;
  isTextarea: boolean;
}

const FIELD_CONFIGS: FieldConfig[] = [
  { key: 'favoriteBlockchains', label: 'Favorite blockchain(s)', maxLength: 50, isTextarea: false },
  { key: 'favoriteNftCollection', label: 'Favorite NFT collection', maxLength: 50, isTextarea: false },
  { key: 'placeOfOrigin', label: 'Place of origin', maxLength: 50, isTextarea: false },
  { key: 'careerJobTitles', label: 'Career/Job titles', maxLength: 100, isTextarea: false },
  { key: 'personalQuirks', label: 'Personal quirks', maxLength: 200, isTextarea: true },
  { key: 'thingsToBragAbout', label: 'Things to brag about', maxLength: 200, isTextarea: true },
  { key: 'thingsToBeAshamedOf', label: 'Things to be ashamed of', maxLength: 200, isTextarea: true },
];

function UserLabel() {
  const { address, isConnected } = useAccount();
  const { data: ensName } = useEnsName({
    address,
    chainId: 1,
    query: { enabled: Boolean(address) },
  });
  const { data: ensAvatar } = useEnsAvatar({
    name: ensName ?? undefined,
    chainId: 1,
    query: { enabled: Boolean(ensName) },
  });

  const displayName = isConnected && ensName ? ensName : 'You';

  return (
    <div className={styles.fieldLabel}>
      {isConnected && ensAvatar ? (
        <img src={ensAvatar} alt={displayName} className={styles.labelAvatar} />
      ) : (
        <div className={styles.labelPlaceholder}>U</div>
      )}
      <span>{displayName}</span>
    </div>
  );
}

function ChatbotLabel() {
  return (
    <div className={styles.fieldLabel}>
      <div className={styles.labelPlaceholder}>R</div>
      <span>RapBotRito</span>
    </div>
  );
}

export function BattleFormModal() {
  const { open, payload, openModal, closeModal } = useModalStore();
  const { battleFormData, updateUserField, updateChatbotField, clearBattleForm, setMode } = useChatModeStore();

  const isOpen = open === 'battleForm';
  
  // Type-guard the payload to ensure it's BattlePayload
  const pendingMode = (payload && 'battleMode' in payload) 
    ? (payload as BattlePayload).battleMode 
    : undefined;

  const hasContent = () => {
    const allValues = [
      ...Object.values(battleFormData.user),
      ...Object.values(battleFormData.chatbot),
    ];
    return allValues.some((val) => val && val.trim().length > 0);
  };

  const handleBack = () => {
    openModal('mode');
  };

  const handleClear = () => {
    if (hasContent()) {
      clearBattleForm();
    }
  };

  const handleDone = () => {
    if (pendingMode) {
      setMode(pendingMode, 'user');
    }
    closeModal();
  };

  return (
    <BaseModal isOpen={isOpen} className={styles.battleFormModal} disableOverlayClose>
      <div className={styles.header}>
        <h2 className={styles.title}>Create Context</h2>
        <p className={styles.subtitle}>
          Adding these background details gives you and RapBotRito clarity on what to rap about. (We don't store any of this information)
        </p>
      </div>

      <div className={styles.scrollContent}>
        {FIELD_CONFIGS.map((config) => (
          <div key={config.key} className={styles.fieldGroup}>
            <h3 className={styles.fieldGroupTitle}>{config.label}</h3>
            <div className={styles.fieldPair}>
              <div className={`${styles.field} ${styles.userField}`}>
                <UserLabel />
                {config.isTextarea ? (
                  <textarea
                    className={styles.textarea}
                    value={battleFormData.user[config.key] || ''}
                    onChange={(e) => updateUserField(config.key, e.target.value)}
                    maxLength={config.maxLength}
                    placeholder={`Your ${config.label.toLowerCase()}...`}
                    autoComplete="off"
                    data-form-type="other"
                  />
                ) : (
                  <input
                    type="text"
                    className={styles.input}
                    value={battleFormData.user[config.key] || ''}
                    onChange={(e) => updateUserField(config.key, e.target.value)}
                    maxLength={config.maxLength}
                    placeholder={`Your ${config.label.toLowerCase()}...`}
                    autoComplete="off"
                    data-form-type="other"
                  />
                )}
              </div>

              <div className={`${styles.field} ${styles.chatbotField}`}>
                <ChatbotLabel />
                {config.isTextarea ? (
                  <textarea
                    className={styles.textarea}
                    value={battleFormData.chatbot[config.key] || ''}
                    onChange={(e) => updateChatbotField(config.key, e.target.value)}
                    maxLength={config.maxLength}
                    placeholder={`RapBotRito's ${config.label.toLowerCase()}...`}
                    autoComplete="off"
                    data-form-type="other"
                  />
                ) : (
                  <input
                    type="text"
                    className={styles.input}
                    value={battleFormData.chatbot[config.key] || ''}
                    onChange={(e) => updateChatbotField(config.key, e.target.value)}
                    maxLength={config.maxLength}
                    placeholder={`RapBotRito's ${config.label.toLowerCase()}...`}
                    autoComplete="off"
                    data-form-type="other"
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.backButton}
          onClick={handleBack}
          aria-label="Back to mode selection"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>

        <button type="button" className={styles.doneButton} onClick={handleDone}>
          Done
        </button>

        <button
          type="button"
          className={styles.trashButton}
          onClick={handleClear}
          disabled={!hasContent()}
          aria-label="Clear form"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 875 1000" aria-hidden="true">
            <path
              fill="currentColor"
              d="M0 281.296l0 -68.355q1.953 -37.107 29.295 -62.496t64.449 -25.389l93.744 0l0 -31.248q0 -39.06 27.342 -66.402t66.402 -27.342l312.48 0q39.06 0 66.402 27.342t27.342 66.402l0 31.248l93.744 0q37.107 0 64.449 25.389t29.295 62.496l0 68.355q0 25.389 -18.553 43.943t-43.943 18.553l0 531.216q0 52.731 -36.13 88.862t-88.862 36.13l-499.968 0q-52.731 0 -88.862 -36.13t-36.13 -88.862l0 -531.216q-25.389 0 -43.943 -18.553t-18.553 -43.943zm62.496 0l749.952 0l0 -62.496q0 -13.671 -8.789 -22.46t-22.46 -8.789l-687.456 0q-13.671 0 -22.46 8.789t-8.789 22.46l0 62.496zm62.496 593.712q0 25.389 18.553 43.943t43.943 18.553l499.968 0q25.389 0 43.943 -18.553t18.553 -43.943l0 -531.216l-624.96 0l0 531.216zm62.496 -31.248l0 -406.224q0 -13.671 8.789 -22.46t22.46 -8.789l62.496 0q13.671 0 22.46 8.789t8.789 22.46l0 406.224q0 13.671 -8.789 22.46t-22.46 8.789l-62.496 0q-13.671 0 -22.46 -8.789t-8.789 -22.46zm31.248 0l62.496 0l0 -406.224l-62.496 0l0 406.224zm31.248 -718.704l374.976 0l0 -31.248q0 -13.671 -8.789 -22.46t-22.46 -8.789l-312.48 0q-13.671 0 -22.46 8.789t-8.789 22.46l0 31.248zm124.992 718.704l0 -406.224q0 -13.671 8.789 -22.46t22.46 -8.789l62.496 0q13.671 0 22.46 8.789t8.789 22.46l0 406.224q0 13.671 -8.789 22.46t-22.46 8.789l-62.496 0q-13.671 0 -22.46 -8.789t-8.789 -22.46zm31.248 0l62.496 0l0 -406.224l-62.496 0l0 406.224zm156.24 0l0 -406.224q0 -13.671 8.789 -22.46t-22.46 -8.789l62.496 0q13.671 0 22.46 8.789t8.789 22.46l0 406.224q0 13.671 -8.789 22.46t-22.46 8.789l-62.496 0q-13.671 0 -22.46 -8.789t-8.789 -22.46zm31.248 0l62.496 0l0 -406.224l-62.496 0l0 406.224z"
            />
          </svg>
        </button>
      </div>
    </BaseModal>
  );
}