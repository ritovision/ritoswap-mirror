console.log("[Instrumentation] File Loaded");
import * as Sentry from "@sentry/nextjs";

export async function register() {
  console.log(`[Instrumentation] Registering. Runtime: ${process.env.NEXT_RUNTIME}`);

  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[Instrumentation] Importing sentry.server.config");
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    console.log("[Instrumentation] Importing sentry.edge.config");
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
