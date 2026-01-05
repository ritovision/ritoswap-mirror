// app/portfolio/components/SelectChain.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useConfig } from 'wagmi';
import { useChainInfo } from '@/components/providers/ChainInfoProvider';
import styles from './SelectChain.module.css';

interface SelectChainProps {
  /** Called whenever the selected chain IDs change */
  onSelectionChange?: (selectedChains: number[]) => void;
}

/**
 * Renders a group of custom-styled checkboxes for each enabled chain.
 * - Container: role="group" + aria-labelledby
 * - Items: role="checkbox", aria-checked, tabIndex, keyboard activation (Enter/Space)
 */
const SelectChain: React.FC<SelectChainProps> = ({ onSelectionChange }) => {
  const { chains } = useConfig();
  const { getChainLogoUrl, getFallbackLogoUrl, getChainDisplayName } = useChainInfo();
  const [checkedMap, setCheckedMap] = useState<Record<number, boolean>>({});

  // Initialize all chains as unchecked when we first get them
  useEffect(() => {
    const initMap: Record<number, boolean> = {};
    chains.forEach((chain) => {
      initMap[chain.id] = false;
    });
    setTimeout(() => setCheckedMap(initMap), 0);
  }, [chains]);

  // Notify parent any time our selection changes
  useEffect(() => {
    if (onSelectionChange) {
      const selected = Object.entries(checkedMap)
        .filter(([, checked]) => checked)
        .map(([id]) => Number(id));
      onSelectionChange(selected);
    }
  }, [checkedMap, onSelectionChange]);

  const toggle = (id: number) =>
    setCheckedMap((prev) => ({ ...prev, [id]: !prev[id] }));

  // Return a keyed onKeyDown handler to toggle via Enter/Space
  const handleItemKeyDown =
    (id: number) => (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle(id);
      }
    };

  return (
    <div
      className={styles.container}
      role="group"
      aria-labelledby="select-chains-title"
    >
      <div className={styles.topSection}>
        <h2 id="select-chains-title" className={styles.title}>
          Select Network(s)
        </h2>
      </div>

      <div className={styles.middleSection}>
        <div className={styles.itemsContainer}>
          {chains.map((chain) => {
            const isChecked = !!checkedMap[chain.id];
            const logoUrl = getChainLogoUrl(chain.id);
            const name = getChainDisplayName(chain.id);

            return (
              <div
                key={chain.id}
                role="checkbox"
                aria-checked={isChecked}
                tabIndex={0}
                onClick={() => toggle(chain.id)}
                onKeyDown={handleItemKeyDown(chain.id)}
                className={styles.item}
              >
                <div className={styles.checkBox}>
                  {isChecked && (
                    <svg
                      viewBox="0 0 24 24"
                      className={styles.checkIcon}
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M9 16.2l-3.5-3.5L4 14.2l5 5 12-12-1.5-1.5L9 16.2z" />
                    </svg>
                  )}
                </div>

                <img
                  src={logoUrl}
                  alt={`${name} logo`}
                  className={styles.chainLogo}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = getFallbackLogoUrl();
                  }}
                />

                <span className={styles.chainName}>{name}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.bottomSection} />
    </div>
  );
};

export default SelectChain;
