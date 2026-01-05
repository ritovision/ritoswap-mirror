// app/portfolio/components/SelectToken.tsx
'use client';

import React, { useState, useEffect } from 'react';
import styles from './SelectToken.module.css';

export type TokenType = 'ERC-20' | 'ERC-721' | 'ERC-1155';

interface SelectTokenProps {
  /** Called whenever the selected token types change */
  onSelectionChange?: (selected: TokenType[]) => void;
}

const OPTIONS: TokenType[] = ['ERC-20', 'ERC-721', 'ERC-1155'];

export default function SelectToken({ onSelectionChange }: SelectTokenProps) {
  const [checked, setChecked] = useState<Record<TokenType, boolean>>({
    'ERC-20': false,
    'ERC-721': false,
    'ERC-1155': false,
  });

  // Notify parent on changes
  useEffect(() => {
    if (onSelectionChange) {
      const selected = OPTIONS.filter((opt) => checked[opt]);
      onSelectionChange(selected);
    }
  }, [checked, onSelectionChange]);

  const toggle = (opt: TokenType) =>
    setChecked((prev) => ({ ...prev, [opt]: !prev[opt] }));

  const handleKeyDown = (opt: TokenType) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle(opt);
    }
  };

  return (
    <div
      className={styles.container}
      role="group"
      aria-labelledby="select-token-title"
    >
      <h2 id="select-token-title" className={styles.title}>
        Select Tokens
      </h2>

      <div className={styles.itemsContainer}>
        {OPTIONS.map((opt) => (
          <div
            key={opt}
            role="checkbox"
            aria-checked={checked[opt]}
            tabIndex={0}
            className={styles.item}
            onClick={() => toggle(opt)}
            onKeyDown={handleKeyDown(opt)}
          >
            <div className={styles.checkBox}>
              {checked[opt] && (
                <svg
                  viewBox="0 0 24 24"
                  className={styles.checkIcon}
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M9 16.2l-3.5-3.5L4 14.2l5 5 12-12-1.5-1.5L9 16.2z" />
                </svg>
              )}
            </div>
            <span className={styles.itemText}>{opt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
