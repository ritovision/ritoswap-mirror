'use client';

import { useState, useEffect } from 'react';
import { LiFiWidget, type WidgetConfig } from '@lifi/widget';
import { useAccount } from 'wagmi';
import styles from '../page.module.css';
import { openWalletConnectModal } from '@/components/wallet/connectModal/connectModalBridge';

export default function SwapClient() {
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const { address, isConnected } = useAccount();

  useEffect(() => {
    const t = setTimeout(() => setWidgetLoaded(true), 1000);
    return () => clearTimeout(t);
  }, []);

  const widgetConfig: WidgetConfig = {
    integrator: 'RitoSwap',

    // Keep widget Connect visible; intercept to open YOUR modal.
    walletConfig: {
      onConnect() {
        openWalletConnectModal();
      },
      // (Optional) enable hybrid mgmt if you later want LI.FI to handle non-EVM wallets
      // usePartialWalletManagement: true,
    },

    theme: {
      container: { boxShadow: '0px 8px 32px rgba(0,0,0,0.08)', borderRadius: '16px' },
      shape: { borderRadius: 10, borderRadiusSecondary: 10 },
      palette: {
        mode: 'dark',
        background: { paper: '#012035', default: '#012035' },
        primary: { main: '#04426C' },
        secondary: { main: '#04426C' },
      },
      typography: { fontFamily: 'var(--font-primary)' },
    },

    appearance: 'dark',
    variant: 'wide',
    subvariant: 'default',
  };

  return (
    <>
      <div className={styles.widgetSpacer}>
        <div className={styles.widgetWrapper}>
          <div className={`${styles.widgetContainer} ${widgetLoaded ? styles.widgetLoaded : ''}`}>
            <div className={`${styles.widgetContent} ${widgetLoaded ? styles.widgetContentVisible : ''}`}>
              <LiFiWidget integrator="RitoSwap" config={widgetConfig} />
            </div>
          </div>
        </div>
      </div>

      <div className={`${styles.caption} ${widgetLoaded ? styles.captionVisible : ''}`}>
        {isConnected
          ? `Connected: ${address?.slice(0, 6)}...${address?.slice(-4)}`
          : 'We receive no fees, profits or benefits from any swaps'}
      </div>
    </>
  );
}
