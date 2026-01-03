// dapp/components/errors/PageError.tsx
"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import ErrorShellInline from "./ErrorShellInline";

export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <ErrorShellInline
      title="Something broke. Rito didn't do it!"
      message="Retry if you can."
      onRetry={reset}
    />
  );
}
