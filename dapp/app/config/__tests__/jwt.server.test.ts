// @vitest-environment node

export {} // Make this file a module to avoid global scope conflicts

// Make 'server-only' a no-op in tests (jwt.server.ts imports it)
vi.mock('server-only', () => ({}))

// Local env helpers (keep this file isolated from hoisted mocks)
const resetEnv = (extraKeys: string[] = []) => {
  const KEYS = [
    'NODE_ENV',
    'DATABASE_URL',
    // JWT
    'JWT_ALG',
    'JWT_SECRET',
    'JWT_PRIVATE_KEY',
    'JWT_PUBLIC_KEY',
    'JWT_ISS',
    'JWT_AUD',
    'JWT_ACCESS_TTL',
    'JWT_CLOCK_TOLERANCE',
    // Public (server.env depends on public.env)
    'NEXT_PUBLIC_ACTIVE_CHAIN',
    'NEXT_PUBLIC_ENABLE_STATE_WORKER',
    'NEXT_PUBLIC_APP_NAME',
    'NEXT_PUBLIC_APP_DESCRIPTION',
    'NEXT_PUBLIC_DOMAIN',
  ]
  for (const k of [...KEYS, ...extraKeys]) delete process.env[k]
}

const seedBase = (overrides: Partial<NodeJS.ProcessEnv> = {}) => {
  resetEnv()
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    // Public defaults used by server.env (avoid extra warnings/throws)
    NEXT_PUBLIC_ACTIVE_CHAIN: 'sepolia',
    NEXT_PUBLIC_ENABLE_STATE_WORKER: 'false',
    NEXT_PUBLIC_APP_NAME: 'Test App',
    NEXT_PUBLIC_APP_DESCRIPTION: 'Test Desc',
    NEXT_PUBLIC_DOMAIN: 'localhost:3000',
    // Minimal JWT shared bits
    JWT_ISS: 'https://example.com',
    JWT_AUD: 'app.example.com',
    // HS256 secret by default (32+ chars)
    JWT_SECRET: 'this_is_a_very_long_test_secret_32_chars_min',
    ...overrides,
  })
}

// Fresh import under the current env
const importJwtServer = async () => {
  vi.resetModules()
  return await import('../jwt.server')
}

describe('jwt.server.ts', () => {
  beforeEach(() => {
    seedBase()
  })

  it('builds HS256 config with secret (Uint8Array) and parsed audiences', async () => {
    // HS256 is default if JWT_ALG not set
    const { jwtServerConfig } = await importJwtServer()
    expect(jwtServerConfig.alg).toBe('HS256')
    expect(jwtServerConfig.issuer).toBe('https://example.com')
    expect(jwtServerConfig.audiences).toEqual(['app.example.com'])
    // secret should be a Uint8Array, private/public should be undefined
    expect(jwtServerConfig.secret).toBeInstanceOf(Uint8Array)
    expect(jwtServerConfig.privateKeyPem).toBeUndefined()
    expect(jwtServerConfig.publicKeyPem).toBeUndefined()
    // defaults from server.env schema
    expect(jwtServerConfig.accessTtlSec).toBe(900)
    expect(jwtServerConfig.clockToleranceSec).toBe(5)
  })

  it('throws when HS256 is selected but JWT_SECRET is missing', async () => {
    seedBase()
    delete process.env.JWT_SECRET
    await expect(importJwtServer()).rejects.toThrow(/JWT_SECRET is required when JWT_ALG=HS256/i)
  })

  it('supports comma-separated audiences', async () => {
    seedBase({
      JWT_AUD: 'app.example.com, api.example.com ,  admin.example.com ',
    })
    const { jwtServerConfig } = await importJwtServer()
    expect(jwtServerConfig.audiences).toEqual([
      'app.example.com',
      'api.example.com',
      'admin.example.com',
    ])
  })

  it('honors access ttl and clock tolerance overrides', async () => {
    seedBase({
      JWT_ACCESS_TTL: '1800',
      JWT_CLOCK_TOLERANCE: '10',
    })
    const { jwtServerConfig } = await importJwtServer()
    expect(jwtServerConfig.accessTtlSec).toBe(1800)
    expect(jwtServerConfig.clockToleranceSec).toBe(10)
  })

  it('builds ES256 config using PEM keys and no symmetric secret', async () => {
    seedBase({
      JWT_ALG: 'ES256',
      // Provide PEM-looking strings; server.env only sanity-checks presence
      JWT_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nABCDEF\n-----END PRIVATE KEY-----',
      JWT_PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----\nABCDEF\n-----END PUBLIC KEY-----',
    })
    delete process.env.JWT_SECRET

    const { jwtServerConfig } = await importJwtServer()
    expect(jwtServerConfig.alg).toBe('ES256')
    expect(jwtServerConfig.secret).toBeUndefined()
    expect(typeof jwtServerConfig.privateKeyPem).toBe('string')
    expect(typeof jwtServerConfig.publicKeyPem).toBe('string')
  })

  it('throws for ES256 when key pair is missing', async () => {
    seedBase({
      JWT_ALG: 'ES256',
    })
    delete process.env.JWT_SECRET
    await expect(importJwtServer()).rejects.toThrow(/JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required/i)
  })
})
