// This file runs on the client to initialize Sentry and capture router transitions.
// The import below triggers sentry.client.config.ts which calls Sentry.init()
import "./sentry.client.config";

import * as Sentry from "@sentry/nextjs";

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
