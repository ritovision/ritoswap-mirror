// @vitest-environment happy-dom

export {} // Make this file a module to avoid global scope conflicts

// Local env helpers for this file only
const resetEnv = (extraKeys: string[] = []) => {
  const KEYS = [
    'NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT',
    'NEXT_PUBLIC_AI_CHAT_API_PATH',
  ]
  for (const k of [...KEYS, ...extraKeys]) delete process.env[k]
}

const seedBase = (overrides: Partial<NodeJS.ProcessEnv> = {}) => {
  resetEnv()
  Object.assign(process.env, overrides)
}

const importAiPublic = async () => {
  vi.resetModules()
  return await import('../ai.public')
}

describe('ai.public.ts', () => {
  beforeEach(() => {
    seedBase()
  })

  it('loads defaults when env is empty', async () => {
    const { aiPublicEnv, aiPublicConfig } = await importAiPublic()
    expect(aiPublicEnv.NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT).toBe(false)
    expect(aiPublicEnv.NEXT_PUBLIC_AI_CHAT_API_PATH).toBe('/api/chat')
    // convenience wrapper mirrors env
    expect(aiPublicConfig.requiresJwt).toBe(false)
    expect(aiPublicConfig.apiPath).toBe('/api/chat')
  })

  it('accepts explicit API path and boolean', async () => {
    seedBase({
      NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT: 'true',
      NEXT_PUBLIC_AI_CHAT_API_PATH: '/api/custom',
    })
    const { aiPublicEnv, aiPublicConfig } = await importAiPublic()
    expect(aiPublicEnv.NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT).toBe(true)
    expect(aiPublicEnv.NEXT_PUBLIC_AI_CHAT_API_PATH).toBe('/api/custom')
    expect(aiPublicConfig.requiresJwt).toBe(true)
    expect(aiPublicConfig.apiPath).toBe('/api/custom')
  })

  it('parses truthy/falsey variants strictly', async () => {
    // truthy variants
    for (const val of ['1', 'true', 't', 'YES', 'y', 'On', 1]) {
      seedBase({ NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT: String(val) })
      const { aiPublicEnv } = await importAiPublic()
      expect(aiPublicEnv.NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT).toBe(true)
    }

    // falsey variants
    for (const val of ['0', 'false', 'F', 'no', 'N', 'off', '', 0]) {
      seedBase({ NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT: String(val) })
      const { aiPublicEnv } = await importAiPublic()
      expect(aiPublicEnv.NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT).toBe(false)
    }

    // unknown string → transform returns false (not truthy)
    seedBase({ NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT: 'maybe' })
    let mod = await importAiPublic()
    expect(mod.aiPublicEnv.NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT).toBe(false)

    // undefined → default false
    seedBase({})
    mod = await importAiPublic()
    expect(mod.aiPublicEnv.NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT).toBe(false)
  })

  it('falls back to schema defaults if validation fails (e.g., empty API path)', async () => {
    seedBase({
      NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT: 'true',
      NEXT_PUBLIC_AI_CHAT_API_PATH: '', // z.string().min(1) should fail safeParse
    })
    const { aiPublicEnv, aiPublicConfig } = await importAiPublic()
    // On failure, module returns schema defaults (requiresJwt false, apiPath '/api/chat')
    expect(aiPublicEnv.NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT).toBe(false)
    expect(aiPublicEnv.NEXT_PUBLIC_AI_CHAT_API_PATH).toBe('/api/chat')
    expect(aiPublicConfig.requiresJwt).toBe(false)
    expect(aiPublicConfig.apiPath).toBe('/api/chat')
  })

  it('exports frozen objects (immutable)', async () => {
    const { aiPublicEnv, aiPublicConfig } = await importAiPublic()

    // Objects should be frozen
    expect(Object.isFrozen(aiPublicEnv)).toBe(true)
    expect(Object.isFrozen(aiPublicConfig)).toBe(true)

    // Their properties should be non-writable
    const envDesc = Object.getOwnPropertyDescriptor(aiPublicEnv, 'NEXT_PUBLIC_AI_CHAT_API_PATH')!
    expect(envDesc.writable).toBe(false)

    const cfgDesc = Object.getOwnPropertyDescriptor(aiPublicConfig, 'apiPath')!
    expect(cfgDesc.writable).toBe(false)

    // Attempting mutation should throw
    expect(() => {
      ;(aiPublicEnv as any).NEXT_PUBLIC_AI_CHAT_API_PATH = '/mutated'
    }).toThrow(TypeError)

    expect(() => {
      ;(aiPublicConfig as any).apiPath = '/mutated'
    }).toThrow(TypeError)
  })
})
