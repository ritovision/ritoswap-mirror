// File: components/navigation/menuLinks/MenuLinks.tsx
"use client";

import React from "react";
import ActiveMenuLink from "./ActiveMenuLink";

export const links = [
  { text: "Home",      href: "/" },
  { text: "Swap",      href: "/swap" },
  { text: "Mint",      href: "/mint" },
  { text: "Gate",      href: "/gate" },
  { text: "Portfolio", href: "/portfolio" },
];

interface MenuLinksProps {
  onClick?: () => void;
}

export default function MenuLinks({ onClick }: MenuLinksProps) {
  return (
    <>
      {links.map(({ text, href }) => (
        <ActiveMenuLink
          key={href}
          text={text}
          href={href}
          onClick={onClick}
          aria-label={`Navigate to ${text.toLowerCase()}`}
        />
      ))}
    </>
  );
}