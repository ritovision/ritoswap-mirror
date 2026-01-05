"use client";

import styles from "./FooterSocials.module.css";
import Image from "next/image";
import Link from "next/link";
import { applyStorybookAssetPrefix } from "@storybook-utils/assetPrefix";

const socialLinks = [
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/rito-matt-j-pellerito-36779084/",
    src: "/images/utilities/socials/linkedin-white.png",
    ariaLabel: "Visit Rito's LinkedIn profile (opens in new tab)",
  },
  {
    name: "Twitter",
    href: "https://x.com/rito_rhymes",
    src: "/images/utilities/socials/twitter-white.png",
    ariaLabel: "Visit Rito's Twitter profile (opens in new tab)",
  },
  {
    name: "Instagram",
    href: "https://instagram.com/ritorhymes",
    src: "/images/utilities/socials/instagram-white.png",
    ariaLabel: "Visit Rito's Instagram profile (opens in new tab)",
  },
  {
    name: "GitHub",
    href: "https://github.com/ritorhymes",
    src: "/images/utilities/socials/github-white.png",
    ariaLabel: "Visit Rito's GitHub profile (opens in new tab)",
  },
];

export default function FooterSocialsClient() {
  return (
    <div className={styles.footerSocialsContainer}>
      <nav 
        className={styles.socialsGrid}
        aria-label="Social media links"
        role="navigation"
      >
        {socialLinks.map((social) => (
          <Link
            key={social.name}
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.socialLink}
            aria-label={social.ariaLabel}
          >
            <div className={styles.socialIconWrapper}>
              <Image
                src={applyStorybookAssetPrefix(social.src)}
                alt=""
                fill
                style={{ objectFit: "contain" }}
                aria-hidden="true"
              />
            </div>
          </Link>
        ))}
      </nav>
      <p className={styles.socialsText} aria-label="Social media section">Socials</p>
    </div>
  );
}
