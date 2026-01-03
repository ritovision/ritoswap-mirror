// app/config/node.env.ts
// Node.js runtime environment variables
// ✅ Safe to import in both client and server components
// These values are already exposed by Next.js to the client

import { z } from 'zod';

// Define the Node environment schema
const nodeSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// Validate Node environment variables
const validateNodeEnv = () => {
  // Only extract the NODE_ENV variable we care about
  const rawNodeEnv = { NODE_ENV: process.env.NODE_ENV };
  const result = nodeSchema.safeParse(rawNodeEnv);

  if (!result.success) {
    console.error('Node environment validation failed:', result.error.format());
    // Provide sensible defaults rather than crashing
    return {
      NODE_ENV: 'development' as const,
    };
  }

  return result.data;
};

// Export the validated and frozen environment variables
export const nodeEnv = Object.freeze(validateNodeEnv());

// Log the environment once at startup (server-side only) with a run-once guard
declare global {
  var __NODE_ENV_LOGGED__: boolean | undefined;
}
if (typeof window === 'undefined' && !globalThis.__NODE_ENV_LOGGED__) {
  console.log(`🔧 Running in ${nodeEnv.NODE_ENV} mode`);
  globalThis.__NODE_ENV_LOGGED__ = true;
}

// Export the full type
export type NodeEnv = typeof nodeEnv;

// Export just the union type for NODE_ENV
export type NodeEnvType = typeof nodeEnv.NODE_ENV;

// Helper utilities for Node environment checks
export const nodeConfig = {
  isDevelopment: nodeEnv.NODE_ENV === 'development',
  isProduction: nodeEnv.NODE_ENV === 'production',
  isTest: nodeEnv.NODE_ENV === 'test',
  environment: nodeEnv.NODE_ENV,
} as const;
