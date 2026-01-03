// components/footer/footerDesktop/FooterDesktopClient.tsx
"use client";

import styles from "./FooterDesktop.module.css";
import Image from "next/image";
import Link from "next/link";
import FooterMenuClient from "@/components/footer/utilities/footerMenu/FooterMenuClient";
import FooterSocialsClient from "../utilities/footerSocials/FooterSocialsClient";
import LogoArrayClient from "../utilities/logoArray/LogoArrayClient";
import FooterLegalClient from "../utilities/footerLegal/FooterLegalClient";

interface FooterDesktopClientProps {
  rightMenuContent?: React.ReactNode;
}

export default function FooterDesktopClient({ rightMenuContent }: FooterDesktopClientProps) {
  return (
    <footer
      className={styles.footer}
      data-testid="footer"          
    >
      {/* Top section: logo + socials */}
      <div className={styles.topRow}>
        <Link href="/" className={styles.logoContainer}>
          <Image
            src="/images/brand/ritoswap.png"
            alt="RitoVision Wordmark"
            width={350}
            height={100}
            className={styles.wordmark}
            priority
          />
        </Link>
        <div className={styles.footerSocialsInline}>
          <FooterSocialsClient />
        </div>
      </div>

      {/* Menu Row */}
      <div className={styles.footerMenuRow}>
        <div className={styles.footerMenuLeft}>
          <FooterMenuClient />
        </div>
        <div className={styles.footerMenuRight}>
          {rightMenuContent || <FooterMenuClient />}
        </div>
      </div>

      {/* Co-brands */}
      <div className={styles.coBrands}>
        <LogoArrayClient />
      </div>

      {/* Legal */}
      <div className={styles.footerLegal}>
        <FooterLegalClient />
      </div>
    </footer>
  );
}
