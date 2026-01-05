// components/utilities/wallet/connectModal/components/ModalWrapper.tsx
"use client";

import React, { forwardRef, PropsWithChildren } from "react";
import { SwipeableHandlers } from "react-swipeable";
import styles from "../styles/ModalWrapper.module.css";

type Props = PropsWithChildren<{
  swipeHandlers?: SwipeableHandlers;
  modalClass: string;
  labelledBy?: string;
}>;

export const ModalWrapper = forwardRef<HTMLDivElement, Props>(function ModalWrapper(
  { swipeHandlers, modalClass, labelledBy, children },
  ref
) {
  return (
    <div
      className={styles.modalWrapper}
      {...(swipeHandlers || {})}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      ref={ref}
    >
      <div className={modalClass}>{children}</div>
    </div>
  );
});
