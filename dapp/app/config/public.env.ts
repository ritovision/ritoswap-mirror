// app/config/public.env.ts
// ✅ Safe to import in both client and server components
import { z } from 'zod';
import { nodeConfig } from './node.env';

// ---- TOP-LEVEL ambient declaration (required by TS) ----
declare global {
  var __PUBLIC_ENV_LOGGED__: boolean | undefined;
}

// Strict boolean parser for env flags (no truthy surprises)
const BoolEnv = z
  .union([z.boolean(), z.number(), z.string()])
  .transform((v) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    const s = (v ?? '').toString().trim().toLowerCase();
    if (['1', 'true', 't', 'yes', 'y', 'on'].includes(s)) return true;
    if (['0', 'false', 'f', 'no', 'n', 'off', ''].includes(s)) return false;
    return false;
  })
  .or(z.undefined())
  .default(false);

// Normalize chain input to lowercase for consistency
const ChainSchema = z
  .enum(['ethereum', 'sepolia', 'ritonet'])
  .transform((val) => val.toLowerCase() as 'ethereum' | 'sepolia' | 'ritonet');

// Define the public schema
const publicSchema = z.object({
  // ⬇️ Default OFF with strict parsing
  NEXT_PUBLIC_ENABLE_STATE_WORKER: BoolEnv,

  NEXT_PUBLIC_ACTIVE_CHAIN: z
    .string()
    .transform((val) => val.toLowerCase())
    .pipe(ChainSchema)
    .default('sepolia'),
  NEXT_PUBLIC_DOMAIN: z.string().default('localhost:3000'),

  NEXT_PUBLIC_LOCAL_CHAIN_ID: z.coerce.number().optional(),
  NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME: z.string().default('RitoNet'),
  NEXT_PUBLIC_LOCAL_BLOCKCHAIN_EXPLORER_URL: z.union([z.url(), z.literal('')]).optional(),
  NEXT_PUBLIC_LOCAL_BLOCKCHAIN_EXPLORER_NAME: z.string().default('RitoNet Explorer'),
  NEXT_PUBLIC_LOCAL_BLOCKCHAIN_RPC: z.url().optional(),
  NEXT_PUBLIC_LOCAL_BLOCKCHAIN_WSS: z
    .string()
    .regex(/^wss?:\/\/.+/, 'Must be a valid WebSocket URL')
    .optional(),

  NEXT_PUBLIC_ALCHEMY_API_KEY: z.string().optional(),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().default('App Name'),
  NEXT_PUBLIC_APP_DESCRIPTION: z.string().default('App Description'),
  NEXT_PUBLIC_SW: BoolEnv,

  // 🔹 New: client log level (optional, non-fatal)
  NEXT_PUBLIC_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),

  // Notification Controls
  NEXT_PUBLIC_LOCAL_NOTIFICATIONS: BoolEnv.default(true),

  // Sentry (public)
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

/** Build a client-safe raw env by explicitly touching each NEXT_PUBLIC_* key. */
const getRawPublicEnv = () => ({
  NEXT_PUBLIC_ENABLE_STATE_WORKER: process.env.NEXT_PUBLIC_ENABLE_STATE_WORKER,
  NEXT_PUBLIC_ACTIVE_CHAIN: process.env.NEXT_PUBLIC_ACTIVE_CHAIN,
  NEXT_PUBLIC_DOMAIN: process.env.NEXT_PUBLIC_DOMAIN,
  NEXT_PUBLIC_LOCAL_CHAIN_ID: process.env.NEXT_PUBLIC_LOCAL_CHAIN_ID,
  NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME: process.env.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME,
  NEXT_PUBLIC_LOCAL_BLOCKCHAIN_EXPLORER_URL: process.env.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_EXPLORER_URL,
  NEXT_PUBLIC_LOCAL_BLOCKCHAIN_EXPLORER_NAME: process.env.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_EXPLORER_NAME,
  NEXT_PUBLIC_LOCAL_BLOCKCHAIN_RPC: process.env.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_RPC,
  NEXT_PUBLIC_LOCAL_BLOCKCHAIN_WSS: process.env.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_WSS,
  NEXT_PUBLIC_ALCHEMY_API_KEY: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_DESCRIPTION: process.env.NEXT_PUBLIC_APP_DESCRIPTION,
  NEXT_PUBLIC_SW: process.env.NEXT_PUBLIC_SW,
  NEXT_PUBLIC_LOG_LEVEL: process.env.NEXT_PUBLIC_LOG_LEVEL,
  NEXT_PUBLIC_LOCAL_NOTIFICATIONS: process.env.NEXT_PUBLIC_LOCAL_NOTIFICATIONS,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
});

// Create the validation function with conditional logic
const validatePublicEnv = () => {
  const isServer = typeof window === 'undefined';

  // ⬇️ use explicit raw object instead of process.env
  const raw = getRawPublicEnv();
  const result = publicSchema.safeParse(raw);

  if (!result.success) {
    // Preserve explicit Redis flag + Domain; defaults fill the rest
    const enableStateWorker = BoolEnv.parse(raw.NEXT_PUBLIC_ENABLE_STATE_WORKER);
    const env = publicSchema.parse({
      NEXT_PUBLIC_ENABLE_STATE_WORKER: enableStateWorker,
      NEXT_PUBLIC_DOMAIN: raw.NEXT_PUBLIC_DOMAIN,
    });

    console.error('Public environment validation issues (preserved explicit flags):', result.error.format());
    return env;
  }

  const env = result.data;
  const errors: string[] = [];

  // Conditional validation for Ritonet chain
  if (env.NEXT_PUBLIC_ACTIVE_CHAIN === 'ritonet') {
    if (!env.NEXT_PUBLIC_LOCAL_CHAIN_ID) {
      errors.push('NEXT_PUBLIC_LOCAL_CHAIN_ID is required when ACTIVE_CHAIN is ritonet');
    }
    if (!env.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_RPC) {
      errors.push('NEXT_PUBLIC_LOCAL_BLOCKCHAIN_RPC is required when ACTIVE_CHAIN is ritonet');
    }
    if (!env.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_WSS) {
      errors.push('NEXT_PUBLIC_LOCAL_BLOCKCHAIN_WSS is required when ACTIVE_CHAIN is ritonet');
    }
  }

  if (errors.length > 0) {
    const errorMessage = `Public environment validation failed:\n${errors.join('\n')}`;
    if (isServer) {
      console.error(errorMessage);
    }
    throw new Error(errorMessage);
  }

  if (isServer) {
    if (!env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
      console.warn('WalletConnect Project ID not configured - WalletConnect integration disabled');
    }
    if (!env.NEXT_PUBLIC_ALCHEMY_API_KEY) {
      console.warn('Alchemy API key not configured - using public RPC endpoints may be rate limited');
    }

    // ---- RUN-ONCE GUARD FOR DEBUG STARTUP LINES ----
    if (!globalThis.__PUBLIC_ENV_LOGGED__) {
      console.log(`Environment configured for chain: ${env.NEXT_PUBLIC_ACTIVE_CHAIN}`);
      console.log(`State worker: ${env.NEXT_PUBLIC_ENABLE_STATE_WORKER ? 'Enabled' : 'Disabled'}`);
      console.log(`Service Worker: ${env.NEXT_PUBLIC_SW ? 'Enabled' : 'Disabled'}`);
      globalThis.__PUBLIC_ENV_LOGGED__ = true;
    }
  }

  return env;
};

// Export the validated and frozen environment variables
export const publicEnv = Object.freeze(validatePublicEnv());

// Export the inferred type
export type PublicEnv = typeof publicEnv;

// Public config helpers (safe for client and server)
export const publicConfig = {
  ...nodeConfig, // { isDevelopment, isProduction, isTest, environment }
  features: {
    stateWorker: publicEnv.NEXT_PUBLIC_ENABLE_STATE_WORKER,
    walletConnect: !!publicEnv.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    serviceWorker: publicEnv.NEXT_PUBLIC_SW,
    localNotifications: publicEnv.NEXT_PUBLIC_LOCAL_NOTIFICATIONS,
  },
  sentry: {
    dsn: publicEnv.NEXT_PUBLIC_SENTRY_DSN,
  },
  activeChain: publicEnv.NEXT_PUBLIC_ACTIVE_CHAIN,
  // 🔹 Expose an explicit client log level with sensible default
  logLevel: (publicEnv.NEXT_PUBLIC_LOG_LEVEL ??
    (nodeConfig.isProduction ? 'warn' : 'debug')) as 'debug' | 'info' | 'warn' | 'error',
} as const;
