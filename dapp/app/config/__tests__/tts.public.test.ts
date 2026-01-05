// @vitest-environment happy-dom

export {} // Make this file a module to avoid global scope conflicts

const resetEnv = (extraKeys: string[] = []) => {
  const KEYS = [
    'NEXT_PUBLIC_TTS_API_PATH',
    'NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT',
    'NEXT_PUBLIC_AI_CHAT_API_PATH',
  ]
  for (const k of [...KEYS, ...extraKeys]) delete process.env[k]
}

const seedBase = (overrides: Partial<NodeJS.ProcessEnv> = {}) => {
  resetEnv()
  Object.assign(process.env, overrides)
}

const importTtsPublic = async () => {
  vi.resetModules()
  return await import('../tts.public')
}

describe('tts.public.ts', () => {
  beforeEach(() => {
    seedBase()
  })

  it('loads defaults when env is empty', async () => {
    const { ttsPublicEnv, ttsPublicConfig } = await importTtsPublic()
    expect(ttsPublicEnv.NEXT_PUBLIC_TTS_API_PATH).toBe('/api/tts')
    expect(ttsPublicConfig.apiPath).toBe('/api/tts')
    expect(ttsPublicConfig.requiresJwt).toBe(false)
  })

  it('accepts explicit API path and carries requiresJwt from ai.public', async () => {
    seedBase({
      NEXT_PUBLIC_TTS_API_PATH: '/api/custom-tts',
      NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT: 'true',
    })
    const { ttsPublicEnv, ttsPublicConfig } = await importTtsPublic()
    expect(ttsPublicEnv.NEXT_PUBLIC_TTS_API_PATH).toBe('/api/custom-tts')
    expect(ttsPublicConfig.apiPath).toBe('/api/custom-tts')
    expect(ttsPublicConfig.requiresJwt).toBe(true)
  })

  it('falls back to defaults when validation fails', async () => {
    seedBase({
      NEXT_PUBLIC_TTS_API_PATH: '',
    })
    const { ttsPublicEnv, ttsPublicConfig } = await importTtsPublic()
    expect(ttsPublicEnv.NEXT_PUBLIC_TTS_API_PATH).toBe('/api/tts')
    expect(ttsPublicConfig.apiPath).toBe('/api/tts')
  })

  it('exports frozen objects (immutable)', async () => {
    const { ttsPublicEnv, ttsPublicConfig } = await importTtsPublic()
    expect(Object.isFrozen(ttsPublicEnv)).toBe(true)
    expect(Object.isFrozen(ttsPublicConfig)).toBe(true)

    const envDesc = Object.getOwnPropertyDescriptor(ttsPublicEnv, 'NEXT_PUBLIC_TTS_API_PATH')!
    expect(envDesc.writable).toBe(false)

    const cfgDesc = Object.getOwnPropertyDescriptor(ttsPublicConfig, 'apiPath')!
    expect(cfgDesc.writable).toBe(false)

    expect(() => {
      ;(ttsPublicEnv as any).NEXT_PUBLIC_TTS_API_PATH = '/mutated'
    }).toThrow(TypeError)

    expect(() => {
      ;(ttsPublicConfig as any).apiPath = '/mutated'
    }).toThrow(TypeError)
  })
})
