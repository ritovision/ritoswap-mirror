'use client';

import * as Accordion from '@radix-ui/react-accordion';
import { motion, AnimatePresence } from 'framer-motion';
import React, { ReactNode, useState, useEffect } from 'react';
import styles from './BigAccordion.module.css';

interface AccordionItem {
  title: ReactNode;
  content: ReactNode;
  value: string;
}

interface BigAccordionProps {
  items: AccordionItem[];
  id?: string;
  className?: string;
  /** Horizontal padding in rems for the content area (default = 2) */
  contentPadding?: number;
  /** Toggle underline animation under title (default = true) */
  showUnderline?: boolean;
}

const variants = {
  open: { height: 'auto', opacity: 1 },
  collapsed: { height: 0, opacity: 0 },
};

type AnimatedContentProps = {
  isOpen: boolean;
  children: React.ReactNode;
  contentPadding: number;
};

const AnimatedContent = React.forwardRef<HTMLDivElement, AnimatedContentProps>(
  ({ isOpen, children, contentPadding }, ref) => (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="content"
          ref={ref}
          className={styles.contentWrapper}
          initial="collapsed"
          animate="open"
          exit="collapsed"
          variants={variants}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          style={{
            overflow: 'hidden',
            paddingLeft: `${contentPadding}rem`,
            paddingRight: `${contentPadding}rem`,
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
);

AnimatedContent.displayName = 'AnimatedContent';

export function BigAccordion({
  items,
  id,
  className = '',
  contentPadding = 2,
  showUnderline = true,
}: BigAccordionProps) {
  const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
  const initialOpenItems = hash && items.some(item => item.value === hash) ? [hash] : [];
  const [openItems, setOpenItems] = useState<string[]>(initialOpenItems);
  const hasScrolledRef = React.useRef(false);

  useEffect(() => {
    // Only scroll to hash on mount if we haven't already
    if (hash && !hasScrolledRef.current && items.some(item => item.value === hash)) {
      hasScrolledRef.current = true;
      const el = document.getElementById(hash);
      if (el) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          el.scrollIntoView({ behavior: 'smooth' });
        });
      }
    }
  }, [hash, items]);

  return (
    <Accordion.Root
      type="multiple"
      value={openItems}
      onValueChange={setOpenItems}
      className={`${styles.accordionRoot} ${className}`}
      id={id}
    >
      {items.map(item => {
        const isOpen = openItems.includes(item.value);

        return (
          <Accordion.Item
            key={item.value}
            value={item.value}
            id={item.value}
            className={styles.accordionItem}
          >
            <Accordion.Header className={styles.accordionHeader}>
              <Accordion.Trigger className={styles.accordionTrigger}>
                <div className={styles.headerWrapper}>
                  <h2 className={styles.title}>{item.title}</h2>
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
                      animate={{
                        rotate: isOpen ? 0 : 90,
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </motion.div>

                  {showUnderline && (
                    <motion.div
                      className={styles.underline}
                      initial={{ scaleX: 0 }}
                      animate={{
                        scaleX: isOpen ? 1 : 0,
                        transformOrigin: 'left center',
                      }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    />
                  )}
                </div>
              </Accordion.Trigger>
            </Accordion.Header>

            <Accordion.Content forceMount asChild>
              <AnimatedContent isOpen={isOpen} contentPadding={contentPadding}>
                {item.content}
              </AnimatedContent>
            </Accordion.Content>
          </Accordion.Item>
        );
      })}
    </Accordion.Root>
  );
}
