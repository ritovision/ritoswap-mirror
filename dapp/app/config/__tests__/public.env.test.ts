// @vitest-environment happy-dom

export {} // Make this file a module to avoid global scope conflicts

// Local env helpers (avoid hoisted mocks)
const resetEnv = (extraKeys: string[] = []) => {
  const KEYS = [
    'NODE_ENV',
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
    'NEXT_PUBLIC_SW',
    'NEXT_PUBLIC_LOG_LEVEL',
    'NEXT_PUBLIC_LOCAL_NOTIFICATIONS',
  ]
  for (const k of [...KEYS, ...extraKeys]) delete process.env[k]
}

const seedBase = (overrides: Partial<NodeJS.ProcessEnv> = {}) => {
  resetEnv()
  Object.assign(process.env, {
    NODE_ENV: 'test',
    NEXT_PUBLIC_ACTIVE_CHAIN: 'sepolia', // default if absent anyway
    NEXT_PUBLIC_DOMAIN: 'localhost:3000',
    NEXT_PUBLIC_APP_NAME: 'App Name',
    NEXT_PUBLIC_APP_DESCRIPTION: 'App Description',
    NEXT_PUBLIC_ENABLE_STATE_WORKER: 'false',
    // intentionally leave others undefined to test defaults
    ...overrides,
  })
}

const importPublicEnv = async () => {
  vi.resetModules()
  return await import('../public.env')
}

describe('public.env.ts', () => {
  beforeEach(() => {
    seedBase()
  })

  it('loads with defaults and normalizes chain to sepolia when not provided', async () => {
    // remove chain to test default
    delete process.env.NEXT_PUBLIC_ACTIVE_CHAIN
    const mod = await importPublicEnv()
    expect(mod.publicEnv.NEXT_PUBLIC_ACTIVE_CHAIN).toBe('sepolia')
    expect(mod.publicEnv.NEXT_PUBLIC_DOMAIN).toBe('localhost:3000')
    // boolean defaults
    expect(mod.publicEnv.NEXT_PUBLIC_ENABLE_STATE_WORKER).toBe(false)
    // client log level default (non-production => 'debug')
    expect(mod.publicConfig.logLevel).toBe('debug')
    // local notifications default true
    expect(mod.publicEnv.NEXT_PUBLIC_LOCAL_NOTIFICATIONS).toBe(true)
  })

  it('parses boolean-like strings strictly for flags (e.g., yes/on/1)', async () => {
    seedBase({
      NEXT_PUBLIC_ENABLE_STATE_WORKER: 'yes',
      NEXT_PUBLIC_SW: 'on',
    })
    const mod = await importPublicEnv()
    expect(mod.publicEnv.NEXT_PUBLIC_ENABLE_STATE_WORKER).toBe(true)
    expect(mod.publicEnv.NEXT_PUBLIC_SW).toBe(true)

    // also test falsey variants
    seedBase({
      NEXT_PUBLIC_ENABLE_STATE_WORKER: 'No',
      NEXT_PUBLIC_SW: '0',
    })
    const mod2 = await importPublicEnv()
    expect(mod2.publicEnv.NEXT_PUBLIC_ENABLE_STATE_WORKER).toBe(false)
    expect(mod2.publicEnv.NEXT_PUBLIC_SW).toBe(false)
  })

  it('throws when ACTIVE_CHAIN=ritonet but required RPC/WSS/ID are missing', async () => {
    seedBase({
      NEXT_PUBLIC_ACTIVE_CHAIN: 'ritonet',
      // intentionally missing: NEXT_PUBLIC_LOCAL_CHAIN_ID, RPC, WSS
    })
    await expect(importPublicEnv()).rejects.toThrow(/Public environment validation failed:/i)
  })

  it('accepts ritonet when all required values are provided and types are validated', async () => {
    seedBase({
      NEXT_PUBLIC_ACTIVE_CHAIN: 'ritonet',
      NEXT_PUBLIC_LOCAL_CHAIN_ID: '90999999', // string → coerce.number in server side but here z.coerce only used in chain? In public: z.coerce.number().optional() so OK
      NEXT_PUBLIC_LOCAL_BLOCKCHAIN_RPC: 'https://localhost:8545',
      NEXT_PUBLIC_LOCAL_BLOCKCHAIN_WSS: 'wss://localhost:8546',
      NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME: 'RitoNet',
      NEXT_PUBLIC_LOCAL_BLOCKCHAIN_EXPLORER_URL: 'https://localhost:3001',
      NEXT_PUBLIC_LOCAL_BLOCKCHAIN_EXPLORER_NAME: 'RitoNet Explorer',
    })
    const mod = await importPublicEnv()
    expect(mod.publicEnv.NEXT_PUBLIC_ACTIVE_CHAIN).toBe('ritonet')
    expect(mod.publicEnv.NEXT_PUBLIC_LOCAL_CHAIN_ID).toBe(90999999)
    expect(mod.publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_RPC).toBe('https://localhost:8545')
    expect(mod.publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_WSS).toBe('wss://localhost:8546')
    expect(mod.publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_EXPLORER_URL).toBe('https://localhost:3001')
  })

  it('recovers with defaults (no throw) when non-ritonet fields fail schema (e.g., bad WSS) but chain is not ritonet', async () => {
    seedBase({
      NEXT_PUBLIC_ACTIVE_CHAIN: 'sepolia',
      NEXT_PUBLIC_LOCAL_BLOCKCHAIN_WSS: 'notaurl', // invalid per regex
    })
    // invalid value triggers safeParse failure → module returns defaults instead of throwing
    const mod = await importPublicEnv()
    expect(mod.publicEnv.NEXT_PUBLIC_ACTIVE_CHAIN).toBe('sepolia') // still ok
    // Because parse failed, WSS gets defaulted (undefined) rather than throwing
    expect(mod.publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_WSS).toBeUndefined()
  })

  it('client log level honors NEXT_PUBLIC_LOG_LEVEL when set', async () => {
    seedBase({
      NEXT_PUBLIC_LOG_LEVEL: 'warn',
    })
    const mod = await importPublicEnv()
    expect(mod.publicConfig.logLevel).toBe('warn')
  })
})
