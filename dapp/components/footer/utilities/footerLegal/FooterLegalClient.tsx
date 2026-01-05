"use client";

import styles from "./FooterLegal.module.css";
import Link from "next/link";
import versions from "@lib/versions/versions";

export default function FooterLegalClient() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footerLegalContainer} role="contentinfo">
      <nav 
        className={styles.legalLinks}
        aria-label="Legal information"
        role="navigation"
      >
        <Link 
          href="/privacy" 
          className={styles.legalLink}
          aria-label="Read our Privacy Policy"
        >
          Privacy Policy
        </Link>
        <Link 
          href="/terms" 
          className={styles.legalLink}
          aria-label="Read our Terms of Service"
        >
          Terms of Service
        </Link>
      </nav>

      <div 
        className={styles.copyright}
        role="contentinfo"
        aria-label="Copyright information"
      >
        RitoSwap v{versions.dapp} © {year}
      </div>

      <div className={styles.siteBuilt}>
        <Link 
          href="https://ritovision.com" 
          target="_blank" 
          rel="noopener noreferrer"
          aria-label="Built by RitoVision with Next.js (opens in new tab)"
        >
          Site Built by RitoVision with Next.js
        </Link>
      </div>
    </footer>
  );
}
