// components/utilities/wallet/connectModal/hooks/useSwipeToClose.ts
"use client";

import { useSwipeable } from "react-swipeable";

export function useSwipeToClose(onClose: () => void) {
  return useSwipeable({
    onSwipedLeft: () => onClose(),
    preventScrollOnSwipe: true,
    trackTouch: true,
    trackMouse: false,
    delta: { left: 50 },
    swipeDuration: 300,
  });
}
