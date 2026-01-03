"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Connector, useConnect } from "wagmi";
import { isMobileDevice } from "@/app/utils/mobile";

export type ModalState =
  | "default"
  | "walletconnect-qr"
  | "connecting"
  | "error"
  | "canceled"
  | "get-wallet";

type WalletInfo = {
  name: string;
  icon?: string;
  isWalletConnect?: boolean;
};

/** Some connectors expose an optional `icon` field (not in wagmi's base type). */
type ConnectorWithOptionalIcon = Connector & { icon?: unknown };

/** Narrower evented provider shape for WalletConnect display_uri handling. */
type EventedProvider = {
  on: (event: string, cb: (uri: string) => void) => void;
  off?: (event: string, cb: (uri: string) => void) => void;
  removeListener?: (event: string, cb: (uri: string) => void) => void;
};

function getConnectorIcon(connector: Connector): string | undefined {
  const icon = (connector as unknown as ConnectorWithOptionalIcon).icon;
  return typeof icon === "string" ? icon : undefined;
}

function hasOn(provider: unknown): provider is EventedProvider {
  return (
    typeof provider === "object" &&
    provider !== null &&
    "on" in provider &&
    typeof (provider as { on?: unknown }).on === "function"
  );
}

export function useWalletConnection() {
  const [state, setState] = useState<ModalState>("default");
  const [qrUri, setQrUri] = useState("");
  const [copied, setCopied] = useState(false);
  const [pendingConnector, setPendingConnector] = useState<string | null>(null);
  const [connectingWallet, setConnectingWallet] = useState<WalletInfo | null>(null);

  const { connectors, connectAsync, reset } = useConnect();
  const runIdRef = useRef(0);
  const activeConnectorRef = useRef<Connector | null>(null);
  const wcCleanupRef = useRef<(() => void) | null>(null);

  const cleanupWalletConnectListener = useCallback(() => {
    wcCleanupRef.current?.();
    wcCleanupRef.current = null;
  }, []);

  const resetUi = useCallback(() => {
    // invalidate any in-flight handler/awaiters
    runIdRef.current += 1;
    cleanupWalletConnectListener();

    setState("default");
    setQrUri("");
    setConnectingWallet(null);
    setCopied(false);
    setPendingConnector(null);
  }, [cleanupWalletConnectListener]);

  const abortConnection = useCallback(() => {
    const active = activeConnectorRef.current;
    const wasConnecting = pendingConnector !== null;
    activeConnectorRef.current = null;

    resetUi();

    // Only reset wagmi state and disconnect if we were NOT in the middle of a connection attempt.
    // If user was still approving in wallet, don't kill the session.
    if (!wasConnecting) {
      reset();
      if (active?.type === "walletConnect" && typeof active.disconnect === "function") {
        Promise.resolve(active.disconnect()).catch(() => {});
      }
    }
  }, [reset, resetUi, pendingConnector]);

  useEffect(() => {
    return () => {
      cleanupWalletConnectListener();
      activeConnectorRef.current = null;
      // invalidate any in-flight handler/awaiters
      runIdRef.current += 1;
    };
  }, [cleanupWalletConnectListener]);

  /**
   * Initiate connection for a given connector.
   * All state transitions that used to live in effects now happen here
   * (success/error), which avoids synchronous setState in effects.
   */
  const handleConnectorClick = useCallback(
    async (connector: Connector) => {
      const runId = ++runIdRef.current;
      try {
        // If this connector is already pending (injected), just show "connecting" again.
        if (pendingConnector === connector.id && connector.type !== "walletConnect") {
          setConnectingWallet({ name: connector.name, icon: getConnectorIcon(connector) });
          setState("connecting");
          return;
        }

        cleanupWalletConnectListener();
        activeConnectorRef.current = connector;
        setPendingConnector(connector.id);

        if (connector.type === "walletConnect") {
          const isMobile = isMobileDevice();

          setConnectingWallet({
            name: "WalletConnect",
            icon: "/images/wallets/walletconnect.png",
            isWalletConnect: true,
          });

          const provider = await connector.getProvider();
          if (hasOn(provider)) {
            const handler = (uri: string) => {
              if (runId !== runIdRef.current) return;
              setQrUri(uri);
              if (isMobile) window.location.href = uri;
            };

            provider.on("display_uri", handler);
            wcCleanupRef.current = () => {
              provider.removeListener?.("display_uri", handler);
              provider.off?.("display_uri", handler);
            };
          }

          setState(isMobile ? "connecting" : "walletconnect-qr");
          await connectAsync({ connector });
        } else {
          // Injected wallet
          setConnectingWallet({ name: connector.name, icon: getConnectorIcon(connector) });
          setState("connecting");
          await connectAsync({ connector });
        }

        if (runId !== runIdRef.current) return;

        // onSuccess: reset local/pending state and return modal to default.
        setPendingConnector(null);
        activeConnectorRef.current = null;
        setState("default");
      } catch (err: unknown) {
        if (runId !== runIdRef.current) return;
        // onError: mirror original behavior (canceled vs error), then reset.
        setPendingConnector(null);
        activeConnectorRef.current = null;

        const message: string =
          typeof err === "object" && err !== null && "message" in err
            ? String((err as { message?: unknown }).message ?? "")
            : "";

        if (message.includes("User rejected") || message.includes("User denied")) {
          setState("canceled");
        } else {
          setState("error");
        }

        setTimeout(() => setState("default"), 1500);
        reset();
      }
    },
    [
      cleanupWalletConnectListener,
      connectAsync,
      pendingConnector,
      reset,
    ]
  );

  const backToDefault = useCallback(() => {
    abortConnection();
  }, [abortConnection]);

  const cancelConnecting = useCallback(() => {
    abortConnection();
  }, [abortConnection]);

  const copyQr = useCallback(() => {
    if (!qrUri) return;
    navigator.clipboard.writeText(qrUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [qrUri]);

  const openWallet = useCallback(() => {
    if (qrUri) window.location.href = qrUri;
  }, [qrUri]);

  // Connector ordering: injected first (excluding the "injected" placeholder), then WalletConnect.
  const injectedConnectors = connectors.filter(
    (c) => c.type === "injected" && c.id !== "injected"
  );
  const walletConnectConnector = connectors.find((c) => c.type === "walletConnect");
  const allConnectors = walletConnectConnector
    ? [...injectedConnectors, walletConnectConnector]
    : injectedConnectors;

  return {
    ui: { state, qrUri, copied, connectingWallet },
    data: { allConnectors },
    actions: {
      handleConnectorClick,
      backToDefault,
      cancelConnecting,
      copyQr,
      openWallet,
      setState,
      resetUi,
      abortConnection,
    },
  };
}
