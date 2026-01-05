'use client';

import React from 'react';
import styles from '../..//ChatMessages.module.css';

export default function UserHeaderFallback() {
  return (
    <div className={styles.messageHeader}>
      <div className={styles.messageRole}>
        <div className={styles.placeholderAvatar}>U</div>
        <span>You</span>
      </div>
    </div>
  );
}
