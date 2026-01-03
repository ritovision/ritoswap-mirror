'use client';

import React, { useEffect, useRef } from 'react';
import styles from './modals.module.css';

interface BaseModalProps {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
  labelledById?: string;
  describedById?: string;
  disableOverlayClose?: boolean;
}

export function BaseModal({
  isOpen,
  children,
  className,
  onClose,
  labelledById,
  describedById,
  disableOverlayClose,
}: BaseModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    prevFocusRef.current = (document.activeElement as HTMLElement) ?? null;

    // ProcessingModal approach: focus the modal container (not the first button)
    modalRef.current?.focus();

    return () => {
      prevFocusRef.current?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const container = modalRef.current;
      if (!container) return;

      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled'));

      if (focusables.length === 0) {
        // If nothing focusable, keep focus on the container
        e.preventDefault();
        container.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      // If focus is on the container and user Shift+Tabs, loop to last
      if (e.shiftKey && active === container) {
        e.preventDefault();
        last.focus();
        return;
      }

      // If focus is on the container and user Tabs, move to first (optional but keeps it tight)
      if (!e.shiftKey && active === container) {
        e.preventDefault();
        first.focus();
        return;
      }

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
        return;
      }

      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
        return;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      data-modal-overlay
      data-testid="base-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledById}
      aria-describedby={describedById}
      onClick={(e) => {
        if (disableOverlayClose) return;
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div
        ref={modalRef}
        className={`${styles.modal} ${className || ''}`}
        data-testid="base-modal"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
