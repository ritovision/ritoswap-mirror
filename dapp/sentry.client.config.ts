// This file configures the initialization of Sentry on the client.
// The config here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { publicEnv } from "@config/public.env";
import { nodeConfig } from "@config/node.env";

const dsn = publicEnv.NEXT_PUBLIC_SENTRY_DSN;
const environment = publicEnv.NEXT_PUBLIC_ACTIVE_CHAIN;
const domainTag = nodeConfig.isProduction ? publicEnv.NEXT_PUBLIC_DOMAIN : undefined;
const debug = !nodeConfig.isProduction;

console.log(`[Sentry Client] DSN value: ${dsn ? dsn.substring(0, 30) + '...' : 'UNDEFINED/EMPTY'}`);
console.log(`[Sentry Client] Environment: ${environment}, Debug: ${debug}`);

Sentry.init({
  dsn,
  environment,
  debug,
  initialScope: {
    tags: {
      ...(domainTag ? { domain: domainTag } : {}),
    },
  },

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: .2,

  // Disable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  // Disable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: false,
});

if (typeof window !== "undefined") {
  // @ts-expect-error - Adding Sentry to window for debugging
  window.Sentry = Sentry;
}
