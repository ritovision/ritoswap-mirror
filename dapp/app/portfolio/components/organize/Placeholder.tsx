// app/portfolio/components/organize/Placeholder.tsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import styles from './Placeholder.module.css';

/**
 * Placeholder shown when the wallet isn’t connected or no chains are selected.
 * Marks itself as a live status region so screen-readers announce the message.
 */
export default function Placeholder() {
  return (
    <motion.div
      className={styles.container}
      role="status"               
      aria-live="polite"          
      aria-atomic="true"          
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: 'easeInOut' }}
    >
      <h2 className={styles.text}>
        Connect Your Wallet, Select a Blockchain and a Token Type to Display Assets Here
      </h2>
    </motion.div>
  );
}
