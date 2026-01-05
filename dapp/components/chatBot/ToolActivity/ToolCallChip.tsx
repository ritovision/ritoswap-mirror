// dapp/components/utilities/chatBot/ToolActivity/ToolCallChip.tsx
'use client';

import React from 'react';
import styles from './ToolActivity.module.css';
import { renderToolChipContent } from './catalog';

export type ToolStatus = 'pending' | 'success' | 'error';

export type ToolCallChipData = {
  toolCallId: string;
  toolName: string;
  status: ToolStatus;
  createdAt: number;
  errorText?: string;
  input?: unknown;
  output?: unknown;
};

export default function ToolCallChip({ chip }: { chip: ToolCallChipData }) {
  const content = renderToolChipContent(chip);

  return (
    <span className={styles.chip} title={chip.errorText || chip.toolName}>
      <span className={styles.icon}>
        {chip.status === 'pending' && <span className={styles.spinner} aria-hidden="true" />}
        {chip.status === 'success' && (
          <span className={styles.check} aria-hidden="true">
            ✔
          </span>
        )}
        {chip.status === 'error' && (
          <span className={styles.cross} aria-hidden="true">
            ✖
          </span>
        )}
      </span>

      <span className={styles.message}>
        {content.label ? <span className={styles.labelLine}>{content.label}</span> : null}
        {content.text ? <span className={styles.text}>{content.text}</span> : null}
      </span>

      <span className="sr-only"> {chip.status}</span>
    </span>
  );
}
