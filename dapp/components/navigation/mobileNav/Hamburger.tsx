'use client';

import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import styles from './Hamburger.module.css';
import MenuNav from './MobileNav';

export default function Hamburger() {
  const [open, setOpen] = useState(false);
  const hamRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggle = () => setOpen(x => !x);

  // click-outside closes
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!open) return;
      if (
        hamRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <>
      {/* only show the gradient mask when the menu is open */}
      {open && <div className={styles.gradient} aria-hidden="true" />}

      <div
        ref={hamRef}
        className={`${styles.hamburger} ${open ? styles.open : ''}`}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={open}
        aria-controls="mobile-navigation"
      >
        <span className={styles.line} aria-hidden="true" />
        <span className={styles.line} aria-hidden="true" />
        <span className={styles.line} aria-hidden="true" />
      </div>

      <AnimatePresence initial={false} mode="wait">
        {open && (
          <MenuNav
            innerRef={menuRef}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}