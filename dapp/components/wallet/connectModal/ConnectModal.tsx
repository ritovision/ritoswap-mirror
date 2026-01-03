"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "wagmi";
import modalStyles from "./styles/ModalWrapper.module.css";

import { ModalWrapper } from "./components/ModalWrapper";
import { DefaultView } from "./views/DefaultView";
import { QrView } from "./views/QrView";
import { ConnectingView } from "./views/ConnectingView";
import { ErrorView } from "./views/ErrorView";
import { CanceledView } from "./views/CanceledView";
import { GetWalletView } from "./views/GetWalletView";

import { useAutoCloseOnRoute } from "./hooks/useAutoCloseOnRoute";
import { useFocusTrap } from "./hooks/useFocusTrap";
import { useSwipeToClose } from "./hooks/useSwipeToClose";
import { useWalletConnection } from "./hooks/useWalletConnection";
import { isMobileDevice } from "@/app/utils/mobile";

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ConnectModal({ isOpen, onClose }: ConnectModalProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  const { ui, data, actions } = useWalletConnection();
  const { isConnected } = useAccount();

  const handleClose = useCallback(
    (opts?: { abort?: boolean }) => {
      if (opts?.abort) actions.abortConnection();
      else actions.resetUi();
      onClose();
    },
    [actions, onClose]
  );

  useAutoCloseOnRoute(isOpen, () => handleClose({ abort: true }));
  useFocusTrap(isOpen, rootRef, () => handleClose({ abort: true }));
  const swipeHandlers = useSwipeToClose(() => handleClose({ abort: true }));

  const wasOpenRef = useRef(isOpen);
  const hasAutoClosedRef = useRef(false);

  useEffect(() => {
    const shouldAutoClose =
      isConnected &&
      isOpen &&
      !hasAutoClosedRef.current &&
      (ui.state === "connecting" || ui.connectingWallet != null);

    if (shouldAutoClose) {
      hasAutoClosedRef.current = true;
      handleClose({ abort: false });
    }
  }, [isConnected, isOpen, ui.state, ui.connectingWallet, handleClose]);

  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      hasAutoClosedRef.current = false;
      if (isConnected) actions.resetUi();
      else actions.abortConnection();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, isConnected, actions]);

  if (!isOpen) return null;

  const modalClass =
    ui.state === "connecting" || ui.state === "error" || ui.state === "canceled"
      ? modalStyles.modalLoading
      : modalStyles.modal;

  const content = (() => {
    switch (ui.state) {
      case "get-wallet":
        return <GetWalletView onBack={actions.backToDefault} />;
      case "walletconnect-qr":
        return (
          <QrView
            qrUri={ui.qrUri}
            copied={ui.copied}
            onBack={actions.backToDefault}
            onCopy={actions.copyQr}
          />
        );
      case "connecting": {
        const isMobile = isMobileDevice();
        const canOpenMobile = !!ui.connectingWallet?.isWalletConnect && isMobile;
        const openWalletDisabled = !ui.qrUri;
        return (
          <ConnectingView
            wallet={ui.connectingWallet}
            onCancel={actions.cancelConnecting}
            onOpenWallet={actions.openWallet}
            onShowQr={() => actions.setState("walletconnect-qr")}
            canOpenMobile={canOpenMobile}
            openWalletDisabled={openWalletDisabled}
          />
        );
      }
      case "error":
        return <ErrorView wallet={ui.connectingWallet} />;
      case "canceled":
        return <CanceledView wallet={ui.connectingWallet} />;
      default:
        return (
          <DefaultView
            connectors={data.allConnectors}
            onSelect={actions.handleConnectorClick}
            onGetWallet={() => actions.setState("get-wallet")}
            onClose={() => handleClose({ abort: true })}
          />
        );
    }
  })();

  return createPortal(
    <>
      <div className={modalStyles.backdrop} onClick={() => handleClose({ abort: true })} aria-label="Close modal" />
      <ModalWrapper
        ref={rootRef}
        swipeHandlers={swipeHandlers}
        modalClass={modalClass}
        labelledBy={ui.state === "default" ? "modal-title" : undefined}
      >
        {content}
      </ModalWrapper>
    </>,
    document.body
  );
}
