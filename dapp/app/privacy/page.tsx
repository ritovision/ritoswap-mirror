// app/privacy/page.tsx
import React from 'react'
import { loadJsonLdScripts } from '@lib/jsonld/loadJsonFromIndex'
import jsonLdData from './jsonld'
import styles from './page.module.css'
import { privacyPageMetadata } from './metadata'

export const metadata = privacyPageMetadata

export default function PrivacyPage() {
  return (
    <>
      {loadJsonLdScripts(jsonLdData, 'privacy-jsonld')}

      <main className={styles.container}>
        <h1 className={styles.title}>Privacy Policy</h1>

        <h2 className={styles.subtitle}>Information We Do Not Collect</h2>
        <p className={styles.text}>
          We do not use cookies. We&nbsp;do not collect emails, names, or any other personal
          identifiable information beyond what’s described below. We&nbsp;do not track wallet
          logins to this website.
        </p>

        <h2 className={styles.subtitle}>Information We Collect</h2>
        <p className={styles.text}>
          When you send a message using a token, we record:<br/>
          • Your wallet address<br/>
          • The raw contents of your message submission<br/>
          We do not store anything else.
        </p>

        <h2 className={styles.subtitle}>Blockchain Transactions</h2>
        <p className={styles.text}>
          Holding, minting, or burning a token is recorded on the blockchain (via smart contract
          logic). Given the immutable nature of blockchains, any information you transmit there
          may be permanent. RitoSwap is not responsible for stewarding blockchain data on
          your behalf.
        </p>

        <h2 className={styles.subtitle}>No Financial Advice</h2>
        <p className={styles.text}>
          This website does not provide financial, investment, or trading advice. NFTs minted
          here are not sold for profit; all transaction fees are paid to the network for
          processing and are required to execute your action.
        </p>

        <h2 className={styles.subtitle}>Intellectual Property</h2>
        <p className={styles.text}>
          All branding and trademarks on this site are the property of Ritovision.
        </p>

        <h2 className={styles.subtitle}>Contact Us</h2>
        <p className={styles.text}>
          Questions? Email us at{' '}
          <a href="mailto:support@ritovision.com" className={styles.link}>
            support@ritovision.com
          </a>.
        </p>
      </main>
    </>
  )
}
