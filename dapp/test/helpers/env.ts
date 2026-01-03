// dapp/test/helpers/env.ts

// --- HOISTED MOCK: Shield tests from importing real server.env in happy-dom ---
vi.mock('@config/server.env', () => {
  // Build a fresh snapshot from process.env each time it's accessed
  const buildServerEnv = () => ({
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test',

    // State worker
    STATE_WORKER_API_KEY: process.env.STATE_WORKER_API_KEY,
    STATE_WORKER_URL: process.env.STATE_WORKER_URL,

    // Email
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    SENDER_EMAIL: process.env.SENDER_EMAIL,
    RECEIVER_EMAIL: process.env.RECEIVER_EMAIL,
    USE_CLOUDFLARE_WORKER: process.env.USE_CLOUDFLARE_WORKER === 'true',
    CLOUDFLARE_WORKER_URL: process.env.CLOUDFLARE_WORKER_URL,

    // R2
    R2_API_ACCESS_KEY_ID: process.env.R2_API_ACCESS_KEY_ID,
    R2_API_SECRET_ACCESS_KEY: process.env.R2_API_SECRET_ACCESS_KEY,
    R2_API_BUCKET_NAME: process.env.R2_API_BUCKET_NAME,
    R2_API_ACCOUNT_ID: process.env.R2_API_ACCOUNT_ID,

    // Backdoor
    BACKDOOR_TOKEN: process.env.BACKDOOR_TOKEN === 'true',
    TOKEN_ID: process.env.TOKEN_ID ? Number(process.env.TOKEN_ID) : undefined,
    BACKDOOR_ADDRESS: process.env.BACKDOOR_ADDRESS,
  })

  const buildServerConfig = (env: ReturnType<typeof buildServerEnv>) => ({
    // Email config helper
    email: {
      isConfigured: !!env.BREVO_API_KEY && !!env.SENDER_EMAIL && !!env.RECEIVER_EMAIL,
      useWorker: env.USE_CLOUDFLARE_WORKER,
      workerUrl: env.CLOUDFLARE_WORKER_URL,
    },

    // R2 config helper
    r2: {
      isConfigured:
        !!env.R2_API_ACCESS_KEY_ID &&
        !!env.R2_API_SECRET_ACCESS_KEY &&
        !!env.R2_API_BUCKET_NAME &&
        !!env.R2_API_ACCOUNT_ID,
    },

    // State worker config (based on public flag for parity with real module)
    stateService: {
      isActive:
        process.env.NEXT_PUBLIC_ENABLE_STATE_WORKER === 'true' &&
        !!env.STATE_WORKER_URL &&
        !!env.STATE_WORKER_API_KEY,
      url: env.STATE_WORKER_URL,
      apiKey: env.STATE_WORKER_API_KEY,
    },

    // Backdoor config
    backdoor: {
      isEnabled: env.BACKDOOR_TOKEN,
      tokenId: env.TOKEN_ID,
      address: env.BACKDOOR_ADDRESS,
    },
  })

  return {
    get serverEnv() {
      return buildServerEnv()
    },
    get serverConfig() {
      return buildServerConfig(buildServerEnv())
    },
  }
})

// All environment variable keys used in the application
const PUBLIC_KEYS = [
  'NEXT_PUBLIC_ENABLE_STATE_WORKER',
  'NEXT_PUBLIC_ACTIVE_CHAIN',
  'NEXT_PUBLIC_DOMAIN',
  'NEXT_PUBLIC_LOCAL_CHAIN_ID',
  'NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME',
  'NEXT_PUBLIC_LOCAL_BLOCKCHAIN_EXPLORER_URL',
  'NEXT_PUBLIC_LOCAL_BLOCKCHAIN_EXPLORER_NAME',
  'NEXT_PUBLIC_LOCAL_BLOCKCHAIN_RPC',
  'NEXT_PUBLIC_LOCAL_BLOCKCHAIN_WSS',
  'NEXT_PUBLIC_ALCHEMY_API_KEY',
  'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID',
  'NEXT_PUBLIC_APP_NAME',
  'NEXT_PUBLIC_APP_DESCRIPTION',
  'NEXT_PUBLIC_RANGO_API_KEY',
  'NEXT_PUBLIC_SW',
  'NEXT_PUBLIC_LOCAL_NOTIFICATIONS',
]

const SERVER_KEYS = [
  'NODE_ENV',
  'DATABASE_URL',
  'STATE_WORKER_URL',
  'STATE_WORKER_API_KEY',
  'BREVO_API_KEY',
  'SENDER_EMAIL',
  'RECEIVER_EMAIL',
  'USE_CLOUDFLARE_WORKER',
  'CLOUDFLARE_WORKER_URL',
  'R2_API_ACCESS_KEY_ID',
  'R2_API_SECRET_ACCESS_KEY',
  'R2_API_BUCKET_NAME',
  'R2_API_ACCOUNT_ID',
  'BACKDOOR_TOKEN',
  'TOKEN_ID',
  'BACKDOOR_ADDRESS',
  'VERCEL_ENV',
]

const ALL_KEYS = [...PUBLIC_KEYS, ...SERVER_KEYS]

/**
 * Reset all environment variables to undefined
 */
export function resetEnv(extraKeys: string[] = []) {
  for (const key of [...ALL_KEYS, ...extraKeys]) {
    delete process.env[key]
  }
}

/**
 * Base defaults for test environment
 * Provides minimal valid configuration
 */
export function seedBase(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  resetEnv()
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    NEXT_PUBLIC_ACTIVE_CHAIN: 'sepolia',
    NEXT_PUBLIC_ENABLE_STATE_WORKER: 'false',
    NEXT_PUBLIC_APP_NAME: 'Test App',
    NEXT_PUBLIC_APP_DESCRIPTION: 'Test Description',
    NEXT_PUBLIC_DOMAIN: 'localhost:3000',
    ...overrides,
  })
}

/**
 * Seed environment for server-side tests
 * Includes all required server environment variables
 */
export function seedServerTest(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  seedBase({
    // Ensure we have all required server vars
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    ...overrides,
  })
}

/**
 * Enable the durable state worker with valid credentials
 */
export function seedStateWorkerOn(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  Object.assign(process.env, {
    NEXT_PUBLIC_ENABLE_STATE_WORKER: 'true',
    STATE_WORKER_URL: 'https://worker.example.dev/state',
    STATE_WORKER_API_KEY: 'test-key',
    ...overrides,
  })
}

/**
 * Disable the durable state worker and clear credentials
 */
export function seedStateWorkerOff(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  Object.assign(process.env, {
    NEXT_PUBLIC_ENABLE_STATE_WORKER: 'false',
    ...overrides,
  })
  delete process.env.STATE_WORKER_URL
  delete process.env.STATE_WORKER_API_KEY
}

/**
 * Configure for Ethereum mainnet
 */
export function seedEthereum(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  Object.assign(process.env, { 
    NEXT_PUBLIC_ACTIVE_CHAIN: 'ethereum',
    ...overrides,
  })
}

/**
 * Configure for Sepolia testnet
 */
export function seedSepolia(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  Object.assign(process.env, { 
    NEXT_PUBLIC_ACTIVE_CHAIN: 'sepolia',
    ...overrides,
  })
}

/**
 * Configure for Ritonet with required variables
 */
export function seedRitonet(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  Object.assign(process.env, {
    NEXT_PUBLIC_ACTIVE_CHAIN: 'ritonet',
    NEXT_PUBLIC_LOCAL_CHAIN_ID: '90999999',
    NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME: 'RitoNet',
    NEXT_PUBLIC_LOCAL_BLOCKCHAIN_RPC: 'https://localhost:8545',
    NEXT_PUBLIC_LOCAL_BLOCKCHAIN_WSS: 'wss://localhost:8546',
    NEXT_PUBLIC_LOCAL_BLOCKCHAIN_EXPLORER_URL: 'https://localhost:3001',
    NEXT_PUBLIC_LOCAL_BLOCKCHAIN_EXPLORER_NAME: 'RitoNet Explorer',
    ...overrides,
  })
}

/**
 * Configure email settings
 */
export function seedEmail(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  Object.assign(process.env, {
    BREVO_API_KEY: 'test-brevo-key',
    SENDER_EMAIL: 'sender@test.com',
    RECEIVER_EMAIL: 'receiver@test.com',
    ...overrides,
  })
}

/**
 * Configure Cloudflare R2 storage
 */
export function seedR2(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  Object.assign(process.env, {
    R2_API_ACCESS_KEY_ID: 'test-access-key',
    R2_API_SECRET_ACCESS_KEY: 'test-secret-key',
    R2_API_BUCKET_NAME: 'test-bucket',
    R2_API_ACCOUNT_ID: 'test-account-id',
    ...overrides,
  })
}

/**
 * Configure backdoor token settings
 */
export function seedBackdoor(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  Object.assign(process.env, {
    BACKDOOR_TOKEN: 'true',
    TOKEN_ID: '1',
    BACKDOOR_ADDRESS: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    ...overrides,
  })
}

/**
 * Reset modules and seed environment
 * This ensures config modules are re-evaluated with new env vars
 */
export function resetModulesAndSeed(
  seeder: (overrides?: Partial<NodeJS.ProcessEnv>) => void = seedBase,
  overrides: Partial<NodeJS.ProcessEnv> = {}
) {
  vi.resetModules()
  seeder(overrides)
}

/**
 * Helper for tests that need complete valid environment
 */
export function seedCompleteTestEnv(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  seedBase()
  seedStateWorkerOn()
  seedEmail()
  seedR2()
  Object.assign(process.env, overrides)
}

/**
 * Save current environment and restore it later
 * Useful for tests that need to preserve env state
 */
export function saveEnv(): NodeJS.ProcessEnv {
  return { ...process.env }
}

export function restoreEnv(saved: NodeJS.ProcessEnv) {
  resetEnv()
  Object.assign(process.env, saved)
}

/**
 * Mock environment for a specific test
 * Automatically restores after test completes
 */
export function withEnv(
  env: Partial<NodeJS.ProcessEnv>,
  fn: () => void | Promise<void>
): () => Promise<void> {
  return async () => {
    const saved = saveEnv()
    try {
      resetEnv()
      Object.assign(process.env, env)
      await fn()
    } finally {
      restoreEnv(saved)
    }
  }
}
