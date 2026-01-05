'use client';

import React from 'react';
import styles from '../ChatMessages.module.css';
import { applyStorybookAssetPrefix } from '@storybook-utils/assetPrefix';

export default function AssistantHeader() {
  return (
    <div className={styles.messageHeader}>
      <div className={styles.messageRole}>
        <img
          src={applyStorybookAssetPrefix('/images/rito/rito-thinker.jpg')}
          alt="RapBotRito"
          className={styles.ensAvatar}
        />
        <span>RapBotRito</span>
      </div>
    </div>
  );
}
