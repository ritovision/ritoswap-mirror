// app/portfolio/components/organize/TokenAccordion.tsx
'use client';

import React, { useState, KeyboardEvent } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { motion, AnimatePresence } from 'framer-motion';
import TokenAccordionContent from '../assets/TokenAccordionContent';
import { TokenType } from '../selection/SelectToken';
import { useAssets } from '@/app/portfolio/hooks/useAssets';
import styles from './TokenAccordion.module.css';
import InlineErrorBoundary from '@/components/errors/InlineErrorBoundary';

interface TokenAccordionProps {
  chainId: number;
  tokenTypes: TokenType[];
  address: string;
}

interface TokenItemProps {
  chainId: number;
  tokenType: TokenType;
  address: string;
  value: string;
  isOpen: boolean;
}

/**
 * Single token accordion item.
 * - Prefetches on hover
 * - Emits proper aria-* attrs for header ↔ panel linkage
 */
function TokenItem({
  chainId,
  tokenType,
  address,
  value,
  isOpen,
}: TokenItemProps) {
  const { prefetch } = useAssets({
    address,
    chainId,
    tokenType,
    enabled: false,
  });

  // unique IDs for aria-controls / aria-labelledby
  const headerId = `token-${value}-header`;
  const panelId = `token-${value}-panel`;

  return (
    <Accordion.Item
      value={value}
      className={styles.accordionItem}
    >
      <Accordion.Header className={styles.accordionHeader}>
        <Accordion.Trigger
          id={headerId}
          className={styles.accordionTrigger}
          aria-controls={panelId}
          onMouseEnter={() => prefetch()}
          onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
            // Support Space/Enter toggle if you ever override default
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.click();
            }
          }}
        >
          <div className={styles.headerWrapper}>
            <h3 className={styles.title}>{tokenType}</h3>
            <motion.div
              className={styles.icon}
              animate={{ rotate: 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className={styles.iconLine}
                animate={{
                  rotate: isOpen ? 90 : 0,
                  opacity: isOpen ? 0 : 1,
                }}
                transition={{ duration: 0.3 }}
              />
              <motion.div
                className={styles.iconLine}
                animate={{ rotate: isOpen ? 0 : 90 }}
                transition={{ duration: 0.3 }}
              />
            </motion.div>
          </div>
          {/* Announce expanded/collapsed state */}
          <span className="sr-only">
            {isOpen ? 'expanded' : 'collapsed'}
          </span>
        </Accordion.Trigger>
      </Accordion.Header>

      <Accordion.Content forceMount asChild>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key="content"
              className={styles.contentWrapper}
              id={panelId}
              role="region"
              aria-labelledby={headerId}
              initial="collapsed"
              animate="open"
              exit="collapsed"
              variants={{
                open: { height: 'auto', opacity: 1 },
                collapsed: { height: 0, opacity: 0 },
              }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <InlineErrorBoundary
                  component={`portfolio-token-${value}`}
                  title={`${tokenType} assets unavailable`}
                >
                  <TokenAccordionContent
                    chainId={chainId}
                    tokenType={tokenType}
                    address={address}
                  />
                </InlineErrorBoundary>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Accordion.Content>
    </Accordion.Item>
  );
}

/**
 * The full token accordion list.
 * Uses a landmark region and aria-label for the group.
 */
export function TokenAccordion({
  chainId,
  tokenTypes,
  address,
}: TokenAccordionProps) {
  const [openItems, setOpenItems] = useState<string[]>([]);

  return (
    <Accordion.Root
      type="multiple"
      value={openItems}
      onValueChange={setOpenItems}
      className={styles.accordionRoot}
      role="region"
      aria-label="Token details"
    >
      {tokenTypes.map((tokenType) => {
        const value = `${chainId}-${tokenType}`;
        const isOpen = openItems.includes(value);

        return (
          <TokenItem
            key={value}
            chainId={chainId}
            tokenType={tokenType}
            address={address}
            value={value}
            isOpen={isOpen}
          />
        );
      })}
    </Accordion.Root>
  );
}
