"use client";

import styles from "./FooterMenu.module.css";
import Link from "next/link";

const menuItems = {
  Home: "/",
  Swap: "/swap",
  Mint: "/mint",
  Gate: "/gate",
  Portfolio: "/portfolio",
};

export default function FooterMenuClient() {
  return (
    <nav 
      className={styles.footerMenuContainer}
      aria-label="Footer navigation menu"
      role="navigation"
    >
      <ul className={styles.leftColumn} role="list">
        {Object.entries(menuItems).map(([label, url]) => (
          <li key={label} className={styles.footerMenuItem} role="listitem">
            <Link 
              href={url}
              aria-label={`Navigate to ${label} page`}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <div className={styles.rightColumn}>
        <h3 aria-label="Navigation menu section">Menu</h3>
      </div>
    </nav>
  );
}