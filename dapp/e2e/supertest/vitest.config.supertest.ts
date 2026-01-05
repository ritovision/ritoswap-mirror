// FILE: c:\Users\Mattj\techstuff\ritoswap-clean\ritoswap1\dapp\e2e\supertest\vitest.config.supertest.ts
import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { validateSupertestEnv } from './env.schema';

type EnvMap = Partial<Record<string, string>>;

/**
 * Load test env with correct precedence:
 * 1) process.env (CI/job-level vars, secrets/vars)
 * 2) .env.supertest (override)
 * 3) .env (per-key fallback)
 */
function loadTestEnv(): EnvMap {
  const merged: EnvMap = {};

  // 1) Start with process.env so CI/job-level env wins by default
  const keys = [
    'PRIVATE_KEY',
    'TOKEN_ID',
    'CHAIN_ID',
    'TEST_BASE_URL',
    'NEXT_PUBLIC_ENABLE_STATE_WORKER',
    'NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT',
    'MCP_ENDPOINT',
  ] as const;

  for (const k of keys) {
    const v = process.env[k];
    if (typeof v === 'string' && v.length) merged[k] = v;
  }

  // Navigate to dapp root (go up from e2e/supertest to dapp)
  const dappRoot = path.resolve(__dirname, '..', '..');
  const supertestEnvPath = path.resolve(dappRoot, '.env.supertest');
  const supertestExamplePath = path.resolve(dappRoot, '.env.supertest.example');
  
  // 2) .env.supertest overrides if present
  if (fs.existsSync(supertestEnvPath)) {
    console.log('✅ Found .env.supertest at:', supertestEnvPath);
    // Manually parse the .env.supertest file
    const supertestEnv = dotenv.parse(fs.readFileSync(supertestEnvPath, 'utf8'));
    // Only override if value doesn't exist in merged (process.env has priority)
    for (const [k, v] of Object.entries(supertestEnv)) {
      if (merged[k] === undefined) merged[k] = v;
    }
  } else {
    // Check if we have missing required vars and warn user
    const missingVars = keys.filter(k => !merged[k]);
    if (missingVars.length > 0) {
      console.warn('⚠️  WARNING: .env.supertest file not detected!');
      console.warn(`   Expected at: ${supertestEnvPath}`);
      console.warn(`   Missing variables: ${missingVars.join(', ')}`);
      if (fs.existsSync(supertestExamplePath)) {
        console.warn('   Please copy .env.supertest.example to .env.supertest and fill in the values to run tests properly.');
      } else {
        console.warn('   Please create a .env.supertest file with the required environment variables.');
      }
      console.warn('   Falling back to .env file if available...\n');
    }
  }

  // 3) .env provides per-key fallback (only if .env.supertest doesn't exist)
  const envPath = path.resolve(dappRoot, '.env');
  if (!fs.existsSync(supertestEnvPath) && fs.existsSync(envPath)) {
    console.log('📁 Falling back to .env file at:', envPath);
    const base = loadEnv('', dappRoot, '');
    for (const [k, v] of Object.entries(base)) {
      if (merged[k] === undefined) merged[k] = v;
    }
  }

  return merged;
}

export default defineConfig(() => {
  const rawEnv = loadTestEnv();
  
  // Validate environment with Zod
  let validatedEnv: Record<string, string>;
  try {
    validatedEnv = validateSupertestEnv(rawEnv);
    console.log('✅ Environment validation passed');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Environment validation failed');
    process.exit(1);
  }

  const mask = (s?: string) => (s ? `${s.slice(0, 6)}...${s.slice(-4)}` : 'NOT SET');
  console.log('🔍 Validated test environment:');
  console.log('  TEST_BASE_URL:', validatedEnv.TEST_BASE_URL);
  console.log('  PRIVATE_KEY:', mask(validatedEnv.PRIVATE_KEY));
  console.log('  TOKEN_ID:', validatedEnv.TOKEN_ID);
  console.log('  CHAIN_ID:', validatedEnv.CHAIN_ID);
  console.log('  NEXT_PUBLIC_ENABLE_STATE_WORKER:', validatedEnv.NEXT_PUBLIC_ENABLE_STATE_WORKER);
  console.log('  NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT:', validatedEnv.NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT);
  console.log('  MCP_ENDPOINT:', validatedEnv.MCP_ENDPOINT);

  return {
    test: {
      name: 'e2e-supertest',
      root: path.resolve(__dirname),
      testTimeout: 30_000,
      hookTimeout: 30_000,
      globals: true,
      environment: 'node',
      setupFiles: ['./setup.ts'],
      include: ['**/*.test.ts'],
      reporters: ['verbose'],
      env: validatedEnv,
      // Run test files sequentially to avoid rate limit conflicts
      // (all files share the same IP-based rate limit)
      fileParallelism: false,
    },
  };
});
