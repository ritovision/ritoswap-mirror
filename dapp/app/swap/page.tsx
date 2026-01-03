// app/swap/page.tsx
import { loadJsonLdScripts } from '@lib/jsonld/loadJsonFromIndex';
import jsonLdData from './jsonld';
import { swapPageMetadata } from './metadata';
import SwapClient from './components/SwapClient';
import Music from './components/Music';
import styles from './page.module.css';
import InlineErrorBoundary from '@/components/errors/InlineErrorBoundary';

export const metadata = swapPageMetadata;

export default function Page() {
  return (
    <>
      {loadJsonLdScripts(jsonLdData, 'swap-jsonld')}

      <main className={styles.main}>
        {/* Floating orbs background (pure CSS, no inline styles) */}
        <div className={styles.orbsContainer}>
          <div className={`${styles.orb} ${styles.orbHuge} ${styles.orb1}`} />
          <div className={`${styles.orb} ${styles.orbMedium} ${styles.orb2}`} />
          <div className={`${styles.orb} ${styles.orbSmall} ${styles.orb3}`} />
          <div className={`${styles.orb} ${styles.orbSmall} ${styles.orb4}`} />
          <div className={`${styles.orb} ${styles.orbSmall} ${styles.orb5}`} />
        </div>

        <div className={styles.container}>
          <h1 className={styles.title}>Cross-Chain DEX</h1>
          <InlineErrorBoundary
            component="swap-client"
            title="Swap unavailable"
          >
            <SwapClient />
          </InlineErrorBoundary>
        </div>

        <div className={styles.musicWrapper}>
          <Music />
        </div>
      </main>
    </>
  );
}
