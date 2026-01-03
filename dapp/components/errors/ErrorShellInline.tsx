// dapp/components/errors/ErrorShellInline.tsx
"use client";

import React from "react";
import FloatingOrbs from "../utilities/animations/FloatingOrbs";

type Props = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

export default function ErrorShellInline({
  title = "Something went wrong",
  message = "Please try again.",
  onRetry,
}: Props) {
  return (
    <div
      style={{
        position: "relative",
        minHeight: "400px",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at center, rgba(1,32,53,0.7), rgba(0,0,0,0.35))",
        color: "var(--foreground)",
        overflow: "hidden",
        borderRadius: 12,
        border: "1px solid rgba(var(--secondary-color-rgb),0.35)",
        margin: "2rem auto",
        maxWidth: 720,
        padding: "2rem",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          borderRadius: 12,
        }}
      >
        <FloatingOrbs />
      </div>

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: 24 }}>
        <h1 style={{ fontSize: "1.875rem", lineHeight: 1.2, margin: "0 0 8px" }}>
          {title}
        </h1>
        <p style={{ opacity: 0.85, margin: "0 0 16px" }}>{message}</p>
        {onRetry ? (
          <button
            onClick={onRetry}
            style={{
              border: "1px solid rgba(var(--secondary-color-rgb),0.8)",
              background: "rgba(var(--secondary-color-rgb),0.2)",
              color: "var(--foreground)",
              padding: "10px 14px",
              borderRadius: 12,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}
