// components/utilities/wallet/connectModal/hooks/useFocusTrap.ts
"use client";

import { RefObject, useEffect, useRef } from "react";

export function useFocusTrap(
  isOpen: boolean,
  containerRef: RefObject<HTMLElement>,
  onClose: () => void
) {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    // Give the DOM a beat so elements mount before focusing
    const t = setTimeout(() => {
      const first = getFocusable(containerRef.current)[0];
      first?.focus();
    }, 50);

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !containerRef.current) return;
      const focusables = getFocusable(containerRef.current);
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("keydown", handleTab);

    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("keydown", handleTab);
      previousActiveElement.current?.focus?.();
    };
  }, [isOpen, onClose, containerRef]);
}

function getFocusable(root?: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  const nodes = root.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  return Array.from(nodes);
}
