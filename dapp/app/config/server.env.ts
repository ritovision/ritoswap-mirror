// app/config/server.env.ts
// ⚠️ NEVER import this file in client components or pages with "use client"
// This file contains sensitive server-side environment variables

import { z } from 'zod';
import { createLogger } from '@logger';
import { publicEnv } from './public.env'; // ✅ single source of truth for the public flag

const logger = createLogger('ServerEnv');

// ---- RUN-ONCE GUARD (top-level ambient declaration) ----
declare global {
  var __SERVER_ENV_LOGGED__: boolean | undefined;
}

// Define the server schema
const serverSchema = z.object({
  // Database - REQUIRED
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Durable state worker (Cloudflare DO) config
  STATE_WORKER_API_KEY: z.string().optional(),
  STATE_WORKER_URL: z.url().optional(),

  // Email Configuration - Optional with warnings
  BREVO_API_KEY: z.string().optional(),
  SENDER_EMAIL: z.string().email().optional(),
  RECEIVER_EMAIL: z.string().email().optional(),
  USE_CLOUDFLARE_WORKER: z.union([z.boolean(), z.string(), z.number()]).transform((v) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    const s = (v ?? '').toString().trim().toLowerCase();
    if (['1', 'true', 't', 'yes', 'y', 'on'].includes(s)) return true;
    if (['0', 'false', 'f', 'no', 'n', 'off', ''].includes(s)) return false;
    return false;
  }).default(false),
  CLOUDFLARE_WORKER_URL: z.url().optional(),

  // Cloudflare R2 - Optional with warnings
  R2_API_ACCESS_KEY_ID: z.string().optional(),
  R2_API_SECRET_ACCESS_KEY: z.string().optional(),
  R2_API_BUCKET_NAME: z.string().optional(),
  R2_API_ACCOUNT_ID: z.string().optional(),

  // Sentry (server-only override + environment tag)
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),

  // Backdoor Configuration
  BACKDOOR_TOKEN: z.union([z.boolean(), z.string(), z.number()]).transform((v) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    const s = (v ?? '').toString().trim().toLowerCase();
    if (['1', 'true', 't', 'yes', 'y', 'on'].includes(s)) return true;
    if (['0', 'false', 'f', 'no', 'n', 'off', ''].includes(s)) return false;
    return false;
  }).default(false),
  TOKEN_ID: z.coerce.number().optional(),
  BACKDOOR_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
    .optional(),

  // ---------- JWT (server-only) ----------
  JWT_ALG: z.enum(['HS256', 'EdDSA', 'ES256']).default('HS256'),
  JWT_SECRET: z.string().optional(),        // required if HS256
  JWT_PRIVATE_KEY: z.string().optional(),   // required if EdDSA/ES256 (PEM)
  JWT_PUBLIC_KEY: z.string().optional(),    // required if EdDSA/ES256 (PEM)
  JWT_ISS: z.string().url(),
  JWT_AUD: z.string().min(1),               // comma-separated list: "ritoswap.app,api.ritoswap.app"
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900), // seconds
  JWT_CLOCK_TOLERANCE: z.coerce.number().int().nonnegative().default(5), // seconds
});

// Create the validation function with conditional logic
const validateServerEnv = () => {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    throw new Error('❌ SECURITY ERROR: server.env.ts cannot be imported in client-side code!');
  }

  // Preprocess environment variables: convert empty strings to undefined
  const processedEnv = Object.fromEntries(
    Object.entries(process.env).map(([key, value]) => [key, value === '' ? undefined : value])
  );

  // First, do a basic parse to get initial values
  const basicParse = serverSchema.safeParse(processedEnv);

  if (!basicParse.success) {
    // Log all parsing errors for debugging
    logger.error('Server environment validation failed:', basicParse.error.format());

    // Check for critical errors (DATABASE_URL)
    const databaseError = basicParse.error.issues.find((issue) => issue.path.includes('DATABASE_URL'));

    if (databaseError) {
      throw new Error(`Critical environment variable missing: ${databaseError.message}`);
    }

    // Log which specific fields failed validation
    const failedFields = basicParse.error.issues.map((issue) => {
      const path = issue.path.join('.');
      const value = process.env[path as keyof NodeJS.ProcessEnv];
      return `${path}: ${issue.message} (current value: ${
        value === '' ? '<empty string>' : value || '<undefined>'
      })`;
    });

    logger.error('Validation errors:', failedFields.join('\n'));

    // For other parse failures, we should still throw
    throw new Error(`Environment validation failed. Check the logs for details.`);
  }

  // Now we can safely access basicParse.data
  const env = basicParse.data;

  // ✅ Single source of truth for the public flag (already strict + default false in public.env.ts)
  const isStateWorkerOn = publicEnv.NEXT_PUBLIC_ENABLE_STATE_WORKER;

  // Conditional validations
  const errors: string[] = [];

  // State worker validation
  if (isStateWorkerOn) {
    if (!env.STATE_WORKER_API_KEY) {
      errors.push('STATE_WORKER_API_KEY is required when NEXT_PUBLIC_ENABLE_STATE_WORKER is true');
    }
    if (!env.STATE_WORKER_URL) {
      errors.push('STATE_WORKER_URL is required when NEXT_PUBLIC_ENABLE_STATE_WORKER is true');
    }
  }

  // Cloudflare Worker validation - Required when USE_CLOUDFLARE_WORKER is true
  if (env.USE_CLOUDFLARE_WORKER) {
    if (!env.CLOUDFLARE_WORKER_URL) {
      errors.push('CLOUDFLARE_WORKER_URL is required when USE_CLOUDFLARE_WORKER is true');
    }
  }

  // Backdoor token validation - TOKEN_ID required when BACKDOOR_TOKEN is true
  if (env.BACKDOOR_TOKEN) {
    if (env.TOKEN_ID === undefined) {
      errors.push('TOKEN_ID is required when BACKDOOR_TOKEN is true');
    }
  }

  // ---------- JWT conditional validation ----------
  const audList = env.JWT_AUD.split(',').map(s => s.trim()).filter(Boolean);
  if (audList.length === 0) {
    errors.push('JWT_AUD must contain at least one audience (comma-separated)');
  }

  if (env.JWT_ALG === 'HS256') {
    if (!env.JWT_SECRET) {
      errors.push('JWT_SECRET is required when JWT_ALG=HS256');
    } else if (env.JWT_SECRET.length < 32) {
      logger.warn('JWT_SECRET is shorter than 32 characters — consider a stronger secret for HS256.');
    }
  } else {
    if (!env.JWT_PRIVATE_KEY || !env.JWT_PUBLIC_KEY) {
      errors.push('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required when JWT_ALG is EdDSA or ES256');
    } else {
      // Soft sanity check for PEM markers (non-fatal)
      const looksPem = (s: string) => /BEGIN (PRIVATE|PUBLIC) KEY/.test(s);
      if (!looksPem(env.JWT_PRIVATE_KEY)) logger.warn('JWT_PRIVATE_KEY does not look like a PEM key.');
      if (!looksPem(env.JWT_PUBLIC_KEY)) logger.warn('JWT_PUBLIC_KEY does not look like a PEM key.');
    }
  }

  // Throw if there are conditional validation errors
  if (errors.length > 0) {
    const errorMessage = `Environment validation failed:\n${errors.join('\n')}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  // Warnings for optional but recommended values
  if (!env.BREVO_API_KEY) {
    logger.warn('BREVO_API_KEY is not configured - email functionality may be limited');
  }
  if (!env.SENDER_EMAIL) {
    logger.warn('SENDER_EMAIL is not configured - email sending will not work');
  }
  if (!env.RECEIVER_EMAIL) {
    logger.warn('RECEIVER_EMAIL is not configured - you will not receive form submissions');
  }

  // R2 warnings
  if (
    !env.R2_API_ACCESS_KEY_ID ||
    !env.R2_API_SECRET_ACCESS_KEY ||
    !env.R2_API_BUCKET_NAME ||
    !env.R2_API_ACCOUNT_ID
  ) {
    logger.warn('Cloudflare R2 configuration is incomplete - file uploads may not work');
  }

  // ---- RUN-ONCE GUARD FOR DEBUG STARTUP LINES ----
  if (!globalThis.__SERVER_ENV_LOGGED__) {
    logger.debug('Server environment variables validated successfully');
    logger.debug(`State worker flag: ${isStateWorkerOn ? 'ON' : 'OFF'}`);
    logger.debug(`Cloudflare Worker: ${env.USE_CLOUDFLARE_WORKER ? 'Enabled' : 'Disabled'}`);
    logger.debug(`JWT: alg=${env.JWT_ALG}, audCount=${audList.length}, accessTTL=${env.JWT_ACCESS_TTL}s`);
    globalThis.__SERVER_ENV_LOGGED__ = true;
  }

  return env;
};

// Export the validated and frozen environment variables
export const serverEnv = Object.freeze(validateServerEnv());

// Export the inferred type
export type ServerEnv = typeof serverEnv;

// Helper utilities for server-side only
export const serverConfig = {
  // Email config helper
  email: {
    isConfigured: !!serverEnv.BREVO_API_KEY && !!serverEnv.SENDER_EMAIL && !!serverEnv.RECEIVER_EMAIL,
    useWorker: serverEnv.USE_CLOUDFLARE_WORKER,
    workerUrl: serverEnv.CLOUDFLARE_WORKER_URL,
  },

  // R2 config helper
  r2: {
    isConfigured:
      !!serverEnv.R2_API_ACCESS_KEY_ID &&
      !!serverEnv.R2_API_SECRET_ACCESS_KEY &&
      !!serverEnv.R2_API_BUCKET_NAME &&
      !!serverEnv.R2_API_ACCOUNT_ID,
  },

  // Durable state worker config
  stateService: {
    isActive:
      publicEnv.NEXT_PUBLIC_ENABLE_STATE_WORKER &&
      !!serverEnv.STATE_WORKER_URL &&
      !!serverEnv.STATE_WORKER_API_KEY,
    url: serverEnv.STATE_WORKER_URL,
    apiKey: serverEnv.STATE_WORKER_API_KEY,
  },

  // Sentry config
  sentry: {
    dsn: serverEnv.SENTRY_DSN || publicEnv.NEXT_PUBLIC_SENTRY_DSN,
    environment: serverEnv.SENTRY_ENVIRONMENT || publicEnv.NEXT_PUBLIC_ACTIVE_CHAIN,
  },

  // Backdoor config
  backdoor: {
    isEnabled: serverEnv.BACKDOOR_TOKEN,
    tokenId: serverEnv.TOKEN_ID,
    address: serverEnv.BACKDOOR_ADDRESS,
  },

  // JWT config (non-secret metadata; do NOT expose this object to the client)
  jwt: {
    alg: serverEnv.JWT_ALG,
    iss: serverEnv.JWT_ISS,
    audRaw: serverEnv.JWT_AUD,
    aud: serverEnv.JWT_AUD.split(',').map(s => s.trim()).filter(Boolean),
    accessTtlSec: serverEnv.JWT_ACCESS_TTL,
    clockToleranceSec: serverEnv.JWT_CLOCK_TOLERANCE,
    // Booleans for diagnostics; do NOT log or expose key material
    hasSymmetricSecret: !!serverEnv.JWT_SECRET,
    hasPrivateKey: !!serverEnv.JWT_PRIVATE_KEY,
    hasPublicKey: !!serverEnv.JWT_PUBLIC_KEY,
  },
} as const;
