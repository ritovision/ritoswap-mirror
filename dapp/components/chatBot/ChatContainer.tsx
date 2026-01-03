'use client';

import { ReactNode } from 'react';
import styles from './ChatContainer.module.css';

interface ChatContainerProps {
  children: ReactNode;
}

export default function ChatContainer({ children }: ChatContainerProps) {
  return (
    <div className={`${styles.container} blueglow`}>
      <div className={styles.imageOverlay} />
      {children}
    </div>
  );
}