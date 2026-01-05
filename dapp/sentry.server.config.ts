// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { serverConfig } from "@config/server.env";
import { publicEnv } from "@config/public.env";
import { nodeConfig } from "@config/node.env";

const dsn = serverConfig.sentry.dsn;
const environment = serverConfig.sentry.environment;
const domainTag = nodeConfig.isProduction ? publicEnv.NEXT_PUBLIC_DOMAIN : undefined;

console.log(`[Sentry Server] Initializing with DSN: ${dsn ? 'Present' : 'MISSING'}`);
console.log(`[Sentry Server] Environment: ${environment}`);

Sentry.init({
  dsn,
  debug: !nodeConfig.isProduction,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: .2,

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
