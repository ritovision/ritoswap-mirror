// File: components/navigation/topNav/TopNav.tsx
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import MenuLinks from '@/components/navigation/menuLinks/MenuLinks';
import ConnectWrapper from '@/components/wallet/connectButton/ConnectWrapper';
import NetworkWidget from '@/components/wallet/network/NetworkWidget';
import AddressDisplay from '@/components/wallet/addressDisplay/AddressDisplay';
import DisconnectButton from '@/components/wallet/disconnectButton/DisconnectButton';
import styles from './TopNav.module.css';

export default function TopNav() {
  // Start as true to trigger fade-in animation on mount
  const [buttonsVisible] = useState(true);

  return (
    <>
      <header className={styles.container} data-testid="header" role="banner">
        <div className={`${styles.links} ${buttonsVisible ? styles.fadeIn : ''}`}>
          <MenuLinks />
        </div>
        <Link href="/" className={styles.logoWrapper} aria-label="RitoSwap - Return to home page">
          <Image
            src="/images/brand/ritoswap.png"
            alt="RitoSwap Logo"
            width={250}
            height={0}
            style={{ height: 'auto', width: '100%' }}
            priority
          />
        </Link>
        <div className={styles.walletContainer} role="toolbar" aria-label="Wallet controls">
          <ConnectWrapper variant="topnav" />
          <NetworkWidget variant="topnav" />
          <AddressDisplay variant="topnav" />
          <DisconnectButton variant="topnav" />
        </div>
      </header>
      <div className={styles.spacer} aria-hidden="true" />
    </>
  );
}