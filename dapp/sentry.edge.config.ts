// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { publicEnv } from "@config/public.env";
import { nodeConfig } from "@config/node.env";

const dsn = process.env.SENTRY_DSN || publicEnv.NEXT_PUBLIC_SENTRY_DSN;
const environment =
  process.env.SENTRY_ENVIRONMENT || publicEnv.NEXT_PUBLIC_ACTIVE_CHAIN;
const domainTag = nodeConfig.isProduction ? publicEnv.NEXT_PUBLIC_DOMAIN : undefined;

Sentry.init({
  dsn,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: false,
  environment,
  initialScope: {
    tags: {
      ...(domainTag ? { domain: domainTag } : {}),
    },
  },
});
