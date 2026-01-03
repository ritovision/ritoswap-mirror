'use client';
import React from 'react';

export default function LinkRenderer({
  label,
  href,
  role,
}: {
  label: string;
  href: string;
  role: 'user' | 'assistant';
}) {
  // Safety: allow only http(s) targets
  const safeHref = /^https?:\/\//i.test(href) ? href : '#';

  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: role === 'user' ? 'var(--primary-accent)' : '#ffffff',
        textDecoration: 'underline',
        cursor: 'pointer',
        textUnderlineOffset: '2px',
      }}
      aria-label={label}
    >
      {label}
    </a>
  );
}
