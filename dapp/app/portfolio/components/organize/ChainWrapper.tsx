// app/portfolio/components/organize/ChainWrapper.tsx
'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import styles from './ChainWrapper.module.css';
import ChainAccordion from './ChainAccordion';
import Placeholder from './Placeholder';
import { TokenType } from '../selection/SelectToken';
import InlineErrorBoundary from '@/components/errors/InlineErrorBoundary';

export interface ChainData {
  chainId: number;
  chainName: string;
  tokens: TokenType[];
}

interface ChainWrapperProps {
  chains: ChainData[];
  address: string;
}

/**
 * Wraps either a placeholder (when no wallet/chains)
 * or an animated list of ChainAccordion sections.
 * Adds ARIA roles & live regions for accessibility.
 */
export default function ChainWrapper({
  chains,
  address,
}: ChainWrapperProps) {
  const isWalletConnected = Boolean(address);
  const hasChainsSelected = chains.length > 0;
  const showPlaceholder = !isWalletConnected || !hasChainsSelected;

  return (
    <AnimatePresence mode="wait">
      {showPlaceholder ? (
        <motion.div
          key="placeholder"
          role="status"
          aria-live="polite"
          aria-busy="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Placeholder />
        </motion.div>
      ) : (
        <motion.section
          key="content"
          className={styles.wrapper}
          role="region"
          aria-label="Selected chains"
          aria-live="polite"
          aria-busy="false"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <AnimatePresence mode="popLayout">
            {chains.map((c, idx) => (
              <motion.div
                key={c.chainId}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{
                  duration: 1,
                  delay: idx * 0.1,
                  ease: 'easeInOut',
                }}
              >
                <InlineErrorBoundary
                  component={`portfolio-chain-${c.chainId}`}
                  title={`${c.chainName} unavailable`}
                >
                  <ChainAccordion
                    chainId={c.chainId}
                    chainName={c.chainName}
                    tokens={c.tokens}
                    address={address}
                  />
                </InlineErrorBoundary>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
