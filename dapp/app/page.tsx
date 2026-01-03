// app/page.tsx
import React from 'react'
import styles from './page.module.css'
import HomeGrid from '@app/home/HomeGrid'
import CryptoMusicSection from '@app/home/CryptoMusicSection'
import { loadJsonLdScripts } from '@lib/jsonld/loadJsonFromIndex'
import homepageJsonLd from './_data/jsonld/homepage'

export default function Page() {
  return (
    <>
      {loadJsonLdScripts(homepageJsonLd, 'homepage-jsonld')}

      <div className={styles.wrapper}>
        <h1 className={styles.intro}>
          RitoSwap is a{' '}
          <span className={styles.primaryRed}>full-stack showcase</span> of the modern dApp experience and a multimodal agentic chatbot.
        </h1>

        <HomeGrid />

        <h2 className={styles.subheading}>
          Trade, mint,{' '}
          <span className={styles.primaryRed}>burn</span> and unlock a token-gate with exclusive music, <span className={styles.primaryRed}>rap battles with a blockchain-enabled AI</span> and a one-per-token messaging channel to the creator,{' '}
          <span className={styles.primaryRed}>Rito</span>.
        </h2>

        <h2 className={styles.subheading}>
          Check out the project{' '}
          <a
            href="https://docs.ritoswap.com"
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.link} ${styles.primaryRed}`}
          >
            Documentation
          </a>{' '}
          and{' '}
          <a
            href="https://github.com/ritovision/ritoswap"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            Codebase
          </a>
          .
        </h2>

        <CryptoMusicSection />
      </div>
    </>
  )
}
