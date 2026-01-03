"use client";

import Link from "next/link";
import OrbImage from "@/components/utilities/media/images/OrbImage";
import styles from "./LogoArray.module.css";

export default function LogoArrayClient() {
  return (
    <div className={styles.logoArrayContainer}>
      <h3 className={styles.logoArrayTitle}>Co-Brands</h3>
      <nav
        className={styles.logoArrayWrapper}
        aria-label="Co-brand websites"
        role="navigation"
      >
        <Link
          href="https://ritovision.com"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.logoArrayLink}
          aria-label="Visit Ritovision website (opens in new tab)"
        >
          <OrbImage
            src="/images/brand/cobrands/ritovision-wordmark-tm.png"
            alt="Ritovision"
            width={250}
            height={150}
            fill={false}
            className={`${styles.logoArrayImage} ${styles.ritovision}`}
          />
        </Link>

        <Link
          href="https://ritography.com"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.logoArrayLink}
          aria-label="Visit Ritography website (opens in new tab)"
        >
          <OrbImage
            src="/images/brand/cobrands/ritography-logo.png"
            alt="Ritography"
            width={300}
            height={150}
            fill={false}
            className={`${styles.logoArrayImage} ${styles.ritography}`}
          />
        </Link>

        <Link
          href="https://ritorhymes.com"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.logoArrayLink}
          aria-label="Visit RitoRhymes website (opens in new tab)"
        >
          <OrbImage
            src="/images/brand/cobrands/RitoRhymes-logo.png"
            alt="RitoRhymes"
            width={200}
            height={200}
            fill={false}
            className={`${styles.logoArrayImage} ${styles.ritorhymes}`}
          />
        </Link>
      </nav>
    </div>
  );
}
