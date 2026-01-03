/* app/gate/components/GatedContentRenderer/GatedContentRenderer.tsx */
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import styles from "./GatedContentRenderer.module.css";
import AudioWrapper from "@/components/utilities/media/audio/AudioWrapper";
import ChatBot from "@/components/chatBot";
import TabsContainer from "../TabsContainer/TabsContainer";

import {
  type GatedContent,
  type GateEnvelope,
  buildEnvelope as clientBuildEnvelope,
  buildBoundMessage as clientBuildBoundMessage,
  normalizeHost,
  API_PATHS,
} from "@/app/lib/client";

/** Narrow window with the gated helpers we attach dynamically. */
interface GateWindow extends Window {
  __gatedEnvelope?: GateEnvelope;
  __gate?: {
    buildEnvelope: () => GateEnvelope;
    buildBoundMessage: (
      tokenId: string | number,
      chainId: number,
      timestamp?: number
    ) => string;
  };
  handleGatedSubmission?: (input: string | { message: string }) => Promise<void>;
}

/** Type guard for objects like { message: string }. */
function isMessageObj(value: unknown): value is { message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

interface GatedContentRendererProps {
  content: GatedContent;
  onSubmit: (text: string) => Promise<void>;
}

/** Stable child so it doesn't remount on every parent render */
function MessageFormContent({
  welcomeText,
  messageFormRef,
  onMount,
}: {
  welcomeText: string;
  messageFormRef: React.RefObject<HTMLDivElement>;
  onMount: () => void;
}) {
  useEffect(() => {
    onMount(); // inject HTML + run script once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className={styles.messageFormWrapper}>
      <div className={styles.welcomeText}>{welcomeText}</div>
      <div ref={messageFormRef} className={styles.messageForm} />
    </div>
  );
}

export default function GatedContentRenderer({
  content,
  onSubmit,
}: GatedContentRendererProps) {
  const messageFormRef = useRef<HTMLDivElement>(null);
  const scriptExecutedRef = useRef(false);
  const [audioError] = useState(false); // left for parity with earlier code

  const initializeForm = useCallback(() => {
    if (!messageFormRef.current) return;

    // Inject HTML
    messageFormRef.current.innerHTML = content.textSubmissionAreaHtml;

    // Run the embedded script only once per mount
    if (!scriptExecutedRef.current) {
      try {
        const runner = new Function(content.script);
        runner();
        scriptExecutedRef.current = true;
      } catch (error) {
        console.error("Error executing gated content script:", error);
      }
    }
  }, [content.textSubmissionAreaHtml, content.script]);

  /** Inject styles (once) and keep them in sync with `content.styles`. */
  useEffect(() => {
    const styleId = "gated-content-styles";
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = content.styles;

    return () => {
      // remove only on full unmount
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, [content.styles]);

  /** Expose helpers + submission hook; do NOT regenerate envelope after signing. */
  useEffect(() => {
    const buildAndStashEnvelope = (): GateEnvelope => {
      const env = clientBuildEnvelope({
        domain: normalizeHost(
          typeof window !== "undefined" ? window.location.host : ""
        ),
        path: API_PATHS.formSubmissionGate,
        method: "POST",
      });
      (window as unknown as GateWindow).__gatedEnvelope = env;
      return env;
    };

    /**
     * Back-compat: allow embed to pass an explicit timestamp (e.g., deterministic tests).
     * When provided, we build an envelope with that timestamp and stash it.
     * Otherwise we build once and stash it; the same envelope must be used for submission.
     */
    const buildBoundMessageCompat = (
      tokenId: string | number,
      chainId: number,
      timestamp?: number
    ): string => {
      let env: GateEnvelope;

      if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
        const domain = normalizeHost(
          typeof window !== "undefined" ? window.location.host : ""
        );
        env = clientBuildEnvelope({
          domain,
          path: API_PATHS.formSubmissionGate,
          method: "POST",
          now: () => timestamp,
        });
        (window as unknown as GateWindow).__gatedEnvelope = env;
      } else {
        env = buildAndStashEnvelope();
      }

      return clientBuildBoundMessage({ tokenId, chainId, envelope: env });
    };

    (window as unknown as GateWindow).__gate = {
      buildEnvelope: buildAndStashEnvelope,
      buildBoundMessage: buildBoundMessageCompat,
    };

    (window as unknown as GateWindow).handleGatedSubmission = async (
      input: string | { message: string }
    ) => {
      const message =
        typeof input === "string"
          ? input
          : isMessageObj(input)
          ? input.message
          : "";

      // 🔒 Critical: DO NOT regenerate the envelope here.
      // The envelope (with its timestamp) must match the one used to build the signed message.
      const win = window as unknown as GateWindow;
      if (!win.__gatedEnvelope) {
        // Fallback for embeds that forgot to build before submitting (shouldn't happen in your flow).
        win.__gatedEnvelope = clientBuildEnvelope({
          domain: normalizeHost(window.location.host),
          path: API_PATHS.formSubmissionGate,
          method: "POST",
        });
      }

      return onSubmit(message);
    };

    return () => {
      const win = window as unknown as GateWindow;
      if (win.handleGatedSubmission) delete win.handleGatedSubmission;
      if (win.__gate) delete win.__gate;
      // keep __gatedEnvelope as-is; it’s ephemeral and harmless if left
    };
  }, [onSubmit]);

  /** On full unmount, allow script to run again on the next mount. */
  useEffect(() => {
    return () => {
      scriptExecutedRef.current = false;
    };
  }, []);

  const musicContent = (
    <div className={styles.musicWrapper}>
      {content.audioData.error || audioError ? (
        <div className={styles.audioError}>
          <h3>Audio Temporarily Unavailable</h3>
          <p>Please refresh the page to try again</p>
        </div>
      ) : (
        <AudioWrapper
          headline={content.audioData.headline}
          imageSrc={content.audioData.imageSrc}
          imageAlt={content.audioData.imageAlt}
          description={content.audioData.description}
          title={content.audioData.title}
          audioSrc={content.audioData.audioSrc}
        />
      )}
    </div>
  );

  const chatbotContent = (
    <div className={styles.chatbotWrapper}>
      <ChatBot />
    </div>
  );

  return (
    <div className={styles.wrapper}>
      <TabsContainer
        messageContent={
          <MessageFormContent
            key={content.textSubmissionAreaHtml} // remount if content payload changes
            welcomeText={content.welcomeText}
            messageFormRef={messageFormRef}
            onMount={initializeForm}
          />
        }
        musicContent={musicContent}
        chatbotContent={chatbotContent}
      />
    </div>
  );
}
