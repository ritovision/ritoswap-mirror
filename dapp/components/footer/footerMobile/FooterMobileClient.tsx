// components/footer/footerMobile/FooterMobileClient.tsx
"use client";

import styles from "./FooterMobile.module.css";
import Image from "next/image";
import Link from "next/link";
import FooterMenuClient from "@/components/footer/utilities/footerMenu/FooterMenuClient";
import FooterSocialsClient from "../utilities/footerSocials/FooterSocialsClient";
import LogoArrayClient from "../utilities/logoArray/LogoArrayClient";
import FooterLegalClient from "../utilities/footerLegal/FooterLegalClient";

export default function FooterMobileClient({ children }: { children?: React.ReactNode }) {
  return (
    <footer
      className={styles.footer}
      data-testid="footer"          
    >
      <Link href="/" className={styles.logoContainer}>
        <Image
          src="/images/brand/ritoswap.png"
          alt="RitoSwap Logo"
          width={400}
          height={100}
          className={styles.logo}
          priority
        />
      </Link>

      {children}

      <FooterMenuClient />
      <FooterSocialsClient />
      <LogoArrayClient />
      <FooterLegalClient />
    </footer>
  );
}
