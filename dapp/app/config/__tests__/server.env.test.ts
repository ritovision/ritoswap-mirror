// @vitest-environment node

export {} // Make this file a module to avoid global scope conflicts

const resetEnv = (extraKeys: string[] = []) => {
  const KEYS = [
    // minimal keys this test touches
    'NODE_ENV',
    'DATABASE_URL',
    'NEXT_PUBLIC_ENABLE_STATE_WORKER',
    'STATE_WORKER_URL',
    'STATE_WORKER_API_KEY',
    'USE_CLOUDFLARE_WORKER',
    'CLOUDFLARE_WORKER_URL',
    'BACKDOOR_TOKEN',
    'TOKEN_ID',
    'BACKDOOR_ADDRESS',
    'JWT_ALG',
    'JWT_SECRET',
    'JWT_PRIVATE_KEY',
    'JWT_PUBLIC_KEY',
    'JWT_ISS',
    'JWT_AUD',
  ]
  for (const k of [...KEYS, ...extraKeys]) delete process.env[k]
}

const seedServerTest = (overrides: Partial<NodeJS.ProcessEnv> = {}) => {
  resetEnv()
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    // HS256 defaults to 'HS256' in schema; we still provide the rest
    JWT_ISS: 'https://example.com',
    JWT_AUD: 'app.example.com',
    JWT_SECRET: 'this_is_a_very_long_test_secret_32_chars_min',
    NEXT_PUBLIC_ENABLE_STATE_WORKER: 'false',
    ...overrides,
  })
}

// Import the real server.env via RELATIVE path (bypasses alias mock)
const importRealServerEnv = async () => {
  // Make sure modules are fresh each time (so env changes take effect)
  vi.resetModules()
  return await import('../server.env')
}

describe('server.env.ts', () => {
  beforeEach(() => {
    seedServerTest()
  })

  it('loads successfully with minimal valid configuration', async () => {
    const mod = await importRealServerEnv()
    expect(mod.serverEnv.DATABASE_URL).toContain('postgresql://')
    // default('HS256') in schema:
    expect(mod.serverEnv.JWT_ALG).toBe('HS256')
    expect(mod.serverEnv.JWT_ISS).toBe('https://example.com')
    expect(mod.serverEnv.JWT_AUD).toBe('app.example.com')
    // State worker flag off → inactive
    expect(mod.serverConfig.stateService.isActive).toBe(false)
  })

  it('enforces state worker creds when NEXT_PUBLIC_ENABLE_STATE_WORKER=true', async () => {
    seedServerTest({
      NEXT_PUBLIC_ENABLE_STATE_WORKER: 'true',
      // intentionally omit STATE_WORKER_API_KEY / STATE_WORKER_URL
    })
    await expect(importRealServerEnv()).rejects.toThrow(/STATE_WORKER_API_KEY is required/i)
  })

  it('enforces CLOUDFLARE_WORKER_URL when USE_CLOUDFLARE_WORKER=true', async () => {
    seedServerTest({
      USE_CLOUDFLARE_WORKER: 'true',
      // omit CLOUDFLARE_WORKER_URL
    })
    await expect(importRealServerEnv()).rejects.toThrow(/CLOUDFLARE_WORKER_URL is required/i)
  })

  it('requires TOKEN_ID when BACKDOOR_TOKEN=true', async () => {
    seedServerTest({
      BACKDOOR_TOKEN: 'true',
      // omit TOKEN_ID
    })
    await expect(importRealServerEnv()).rejects.toThrow(/TOKEN_ID is required/i)
  })

  it('requires JWT_SECRET when alg=HS256', async () => {
    // seed with valid base first then explicitly DELETE the secret
    seedServerTest({
      JWT_ISS: 'https://example.com',
      JWT_AUD: 'app.example.com',
      JWT_SECRET: 'this_is_a_very_long_test_secret_32_chars_min',
    })
    delete process.env.JWT_SECRET // do NOT set to undefined (it becomes the string "undefined")

    await expect(importRealServerEnv()).rejects.toThrow(/JWT_SECRET is required when JWT_ALG=HS256/i)
  })

  it('requires key pair when alg=ES256', async () => {
    seedServerTest({
      JWT_ALG: 'ES256',
      // omit JWT_PRIVATE_KEY / JWT_PUBLIC_KEY
    })
    await expect(importRealServerEnv()).rejects.toThrow(/JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required/i)
  })

  it('validates JWT_AUD contains at least one audience', async () => {
    seedServerTest({
      JWT_AUD: ' , , ',
    })
    await expect(importRealServerEnv()).rejects.toThrow(/JWT_AUD must contain at least one audience/i)
  })

  it('activates state worker only when public flag + creds are present', async () => {
    seedServerTest({
      NEXT_PUBLIC_ENABLE_STATE_WORKER: 'true',
      STATE_WORKER_URL: 'https://worker.example.dev/state',
      STATE_WORKER_API_KEY: 'test-key',
    })
    const mod = await importRealServerEnv()
    expect(mod.serverConfig.stateService.isActive).toBe(true)
    expect(mod.serverConfig.stateService.url).toBe('https://worker.example.dev/state')
  })
})
