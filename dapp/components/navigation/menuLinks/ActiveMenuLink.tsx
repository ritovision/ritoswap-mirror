// components/navigation/menuLinks/ActiveMenuLink.tsx
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./ActiveMenuLink.module.css";

interface ActiveMenuLinkProps {
  /** Link label */
  text: string;
  /** Destination URL */
  href: string;
  /** Optional click handler (e.g. to close a mobile menu) */
  onClick?: () => void;
}

/**
 * A single nav link that applies an "active" style
 * when its href matches the current pathname.
 */
export default function ActiveMenuLink({
  text,
  href,
  onClick,
}: ActiveMenuLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`${styles.button} ${isActive ? styles.active : ""}`}
      aria-current={isActive ? "page" : undefined}
    >
      {text}
    </Link>
  );
}
