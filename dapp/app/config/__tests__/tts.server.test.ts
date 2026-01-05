// @vitest-environment node

export {} // Make this file a module to avoid global scope conflicts

vi.mock('server-only', () => ({}))

vi.mock('@logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

const resetEnv = (extraKeys: string[] = []) => {
  const KEYS = [
    'TTS_PROVIDER',
    'ELEVENLABS_API_KEY',
    'ELEVENLABS_VOICE_ID',
    'ELEVENLABS_MODEL_ID',
    'ELEVENLABS_BASE_URL',
    'ELEVENLABS_OUTPUT_FORMAT',
    'ELEVENLABS_VOICE_STABILITY',
    'ELEVENLABS_VOICE_SIMILARITY',
  ]
  for (const k of [...KEYS, ...extraKeys]) delete process.env[k]
}

const seedBase = (overrides: Partial<NodeJS.ProcessEnv> = {}) => {
  resetEnv()
  Object.assign(process.env, overrides)
}

const importTtsServer = async () => {
  vi.resetModules()
  return await import('../tts.server')
}

describe('tts.server.ts', () => {
  beforeEach(() => {
    seedBase()
    globalThis.__TTS_SERVER_ENV_LOGGED__ = undefined
  })

  it('defaults to disabled provider with normalized base url', async () => {
    const { ttsServerConfig } = await importTtsServer()
    expect(ttsServerConfig.provider).toBe('disabled')
    expect(ttsServerConfig.elevenlabs.baseUrl).toBe('https://api.elevenlabs.io/v1')
    expect(ttsServerConfig.elevenlabs.outputFormat).toBe('mp3_44100_128')
  })

  it('throws when ElevenLabs is selected but required keys are missing', async () => {
    seedBase({
      TTS_PROVIDER: 'elevenlabs',
    })
    await expect(importTtsServer()).rejects.toThrow(/ELEVENLABS_API_KEY is required/i)
    await expect(importTtsServer()).rejects.toThrow(/ELEVENLABS_VOICE_ID is required/i)
  })

  it('normalizes base URL and passes through voice settings', async () => {
    seedBase({
      TTS_PROVIDER: 'elevenlabs',
      ELEVENLABS_API_KEY: 'key',
      ELEVENLABS_VOICE_ID: 'voice',
      ELEVENLABS_MODEL_ID: 'model',
      ELEVENLABS_BASE_URL: 'https://example.com/tts',
      ELEVENLABS_OUTPUT_FORMAT: 'mp3_22050_32',
      ELEVENLABS_VOICE_STABILITY: '0.2',
      ELEVENLABS_VOICE_SIMILARITY: '0.7',
    })
    const { ttsServerConfig } = await importTtsServer()
    expect(ttsServerConfig.provider).toBe('elevenlabs')
    expect(ttsServerConfig.elevenlabs.baseUrl).toBe('https://example.com/tts/v1')
    expect(ttsServerConfig.elevenlabs.outputFormat).toBe('mp3_22050_32')
    expect(ttsServerConfig.elevenlabs.voiceSettings).toEqual({
      stability: 0.2,
      similarityBoost: 0.7,
    })
    expect(ttsServerConfig.elevenlabs.modelId).toBe('model')
  })
})
