// FILE: c:\Users\Mattj\techstuff\ritoswap-clean\ritoswap1\dapp\e2e\supertest\env.schema.ts
import { z } from 'zod';

/**
 * Zod schema for supertest environment validation
 * Provides runtime type checking and coercion for test configuration
 */
export const supertestEnvSchema = z.object({
  // Test target URL - validates URL format and defaults to localhost
  TEST_BASE_URL: z
    .string()
    .default('http://localhost:3000')
    .refine(
      (val) => {
        try {
          new URL(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'TEST_BASE_URL must be a valid URL' }
    )
    .catch('http://localhost:3000'), // Fallback on malformed URLs
  
  // Private key - required, no default
  PRIVATE_KEY: z
    .string()
    .min(1, 'PRIVATE_KEY is required for test authentication')
    .refine(
      (val) => val.length > 0 && val !== 'undefined',
      'PRIVATE_KEY cannot be empty - please provide a test wallet private key'
    ),
  
  // Token ID - required, coerced to number
  TOKEN_ID: z
    .string()
    .min(1, 'TOKEN_ID is required')
    .transform((val) => {
      const num = parseInt(val, 10);
      if (isNaN(num)) {
        throw new Error('TOKEN_ID must be a numeric value');
      }
      return val; // Keep as string for the API calls
    }),
  
  // Chain ID - coerced to number, defaults to 1
  CHAIN_ID: z
    .string()
    .default('1')
    .transform((val) => {
      const num = parseInt(val, 10);
      if (isNaN(num)) {
        console.warn('CHAIN_ID is not numeric, defaulting to 1');
        return '1';
      }
      return val;
    })
    .catch('1'), // Fallback to mainnet
  
  // State worker/SIWE toggle - coerced to boolean, defaults to false
  NEXT_PUBLIC_ENABLE_STATE_WORKER: z
    .string()
    .optional()
    .transform((val) => val === 'true')
    .default(false)
    .transform((val) => String(val)) // Convert back to string for env
    .catch('false'),

  // AI Chat requires JWT toggle - default false
  NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT: z
    .string()
    .optional()
    .transform((val) => val === 'true')
    .default(false)
    .transform((val) => String(val))
    .catch('false'),

  // MCP endpoint - default /api/mcp, must start with '/'
  MCP_ENDPOINT: z
    .string()
    .default('/api/mcp')
    .transform((v) => (v || '').trim() || '/api/mcp')
    .refine((v) => v.startsWith('/'), 'MCP_ENDPOINT must start with "/"')
    .catch('/api/mcp'),
});

export type SupertestEnv = z.infer<typeof supertestEnvSchema>;

/**
 * Validates and returns the parsed environment configuration
 * Throws with detailed error message if validation fails
 */
export function validateSupertestEnv(env: Record<string, string | undefined>): SupertestEnv {
  try {
    return supertestEnvSchema.parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => 
        `  - ${issue.path.join('.')}: ${issue.message}`
      ).join('\n');
      
      throw new Error(
        `\n❌ Supertest environment validation failed:\n${issues}\n\n` +
        `Please ensure your .env.supertest file contains all required variables.\n` +
        `See .env.supertest.example for reference.`
      );
    }
    throw error;
  }
}
