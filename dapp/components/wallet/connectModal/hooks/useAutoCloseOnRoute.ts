// components/utilities/wallet/connectModal/hooks/useAutoCloseOnRoute.ts
"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function useAutoCloseOnRoute(isOpen: boolean, onClose: () => void) {
  const pathname = usePathname();
  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPathnameRef.current && isOpen) {
      onClose();
    }
    prevPathnameRef.current = pathname;
  }, [pathname, isOpen, onClose]);
}
