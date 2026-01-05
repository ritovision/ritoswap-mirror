// app/terms/page.tsx
import React from 'react'
import { loadJsonLdScripts } from '@lib/jsonld/loadJsonFromIndex'
import jsonLdData from './jsonld'
import styles from './page.module.css'
import { termsPageMetadata } from './metadata'

export const metadata = termsPageMetadata

export default function TermsPage() {
  return (
    <>
      {loadJsonLdScripts(jsonLdData, 'terms-jsonld')}

      <main className={styles.container}>
        <h1 className={styles.title}>Terms of Service</h1>

        <h2 className={styles.subtitle}>1. Acceptance of Terms</h2>
        <p className={styles.text}>
          By using RitoSwap, you agree to these Terms of Service. If you do not agree, please
          refrain from using this site.
        </p>

        <h2 className={styles.subtitle}>2. Use of Service</h2>
        <p className={styles.text}>
          You may access and interact with the dApp to trade, mint, burn, or send messages via tokens.
        </p>

        <h2 className={styles.subtitle}>3. Data &amp; Cookies</h2>
        <ul className={styles.list}>
          <li className={styles.listItem}>No cookies are used.</li>
          <li className={styles.listItem}>
            Data collected is limited to wallet addresses and message content when you send a message.
          </li>
          <li className={styles.listItem}>No tracking of wallet logins, emails, or other personal data.</li>
        </ul>

        <h2 className={styles.subtitle}>4. Blockchain Transactions</h2>
        <p className={styles.text}>
          All token actions (hold, mint, burn) are recorded on-chain. Because blockchains are
          immutable, that information may be permanent. RitoSwap does not steward or alter
          on-chain data.
        </p>

        <h2 className={styles.subtitle}>5. No Financial Advice</h2>
        <p className={styles.text}>
          This site does not provide financial or investment advice. NFTs minted here are not
          sold for a profit; all fees go directly to the network for transaction processing.
        </p>

        <h2 className={styles.subtitle}>6. Intellectual Property</h2>
        <p className={styles.text}>
          All branding, logos, and trademarks on RitoSwap are the property of Ritovision.
        </p>

        <h2 className={styles.subtitle}>7. Disclaimers &amp; No Warranty</h2>
        <p className={styles.text}>
          The service is provided “as is” and “as available.” RitoSwap makes no warranties,
          express or implied, and is not liable for any use or misuse of the site.
        </p>

        <h2 className={styles.subtitle}>8. Governing Law</h2>
        <p className={styles.text}>
          These Terms are governed by the laws of the State of Delaware, without regard to its
          conflict of laws rules.
        </p>

        <h2 className={styles.subtitle}>9. Contact</h2>
        <p className={styles.text}>
          For questions about these Terms, email{' '}
          <a href="mailto:support@ritovision.com" className={styles.link}>
            support@ritovision.com
          </a>.
        </p>
      </main>
    </>
  )
}
