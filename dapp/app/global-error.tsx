"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import ErrorShellFullPage from "@/components/errors/ErrorShellFullPage";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <ErrorShellFullPage
          title="Oh how the mighty have fallen..."
          message="The site is too much for itself. Try again soon."
        />
      </body>
    </html>
  );
}
