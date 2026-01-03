// @vitest-environment node

export {} // Make this file a module to avoid global scope conflicts

// Make 'server-only' a no-op in tests (ai.server.ts imports it)
vi.mock('server-only', () => ({}))

// Silence logger usage inside ai.server.ts and its dependencies
vi.mock('@logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Minimal env helpers (local to this file)
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
    // Public / AI flags
    'NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT',
    'NEXT_PUBLIC_AI_CHAT_API_PATH',
    'NEXT_PUBLIC_ACTIVE_CHAIN',
    'NEXT_PUBLIC_ENABLE_STATE_WORKER',
    // AI server
    'AI_PROVIDER',
    'AI_BASE_URL',
    'AI_OPENAI_MODEL_1',
    'AI_OPENAI_MODEL_2',
    'AI_OPENAI_MODEL_3',
    'AI_LOCAL_MODEL_1',
    'AI_LOCAL_MODEL_2',
    'AI_LOCAL_MODEL_3',
    'AI_OPENAI_VISION_MODEL',
    'AI_LOCAL_VISION_MODEL',
    'AI_TEMPERATURE',
    'AI_CHAT_MAX_OUTPUT_TOKENS',
    'AI_CHAT_MAX_DURATION',
    'AI_CHAT_QUOTA_ENABLED',
    'AI_CHAT_QUOTA_TOKENS',
    'AI_CHAT_QUOTA_WINDOW_SEC',
    // Images
    'AI_IMAGE_PROVIDER',
    'OPENAI_API_KEY',
    'OPENAI_IMAGE_MODEL',
    'OPENAI_IMAGE_API_KEY',
    'REPLICATE_API_TOKEN',
    'HUGGINGFACE_API_TOKEN',
    'HUGGINGFACE_IMAGE_MODEL',
    'HUGGINGFACE_BASE_URL',
    'IMAGE_DEFAULT_SIZE',
    'IMAGE_DEFAULT_QUALITY',
    'IMAGE_MAX_CONCURRENCY',
    'IMAGE_MAX_DURATION',
  ]
  for (const k of [...KEYS, ...extraKeys]) delete process.env[k]
}

const seedBase = (overrides: Partial<NodeJS.ProcessEnv> = {}) => {
  resetEnv()
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    // minimal valid JWT (HS256 default)
    JWT_ISS: 'https://example.com',
    JWT_AUD: 'app.example.com',
    JWT_SECRET: 'this_is_a_very_long_test_secret_32_chars_min',
    // public defaults
    NEXT_PUBLIC_ACTIVE_CHAIN: 'sepolia',
    NEXT_PUBLIC_ENABLE_STATE_WORKER: 'false',
    NEXT_PUBLIC_AI_CHAT_API_PATH: '/api/chat',
    NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT: 'false',
    // AI defaults
    AI_PROVIDER: 'lmstudio',
    AI_BASE_URL: 'http://127.0.0.1:1234', // will normalize to /v1
    AI_LOCAL_MODEL_1: 'llama-3.1-8b-lexi-uncensored-v2',
    // Image provider defaults (openai) to avoid throws unless testing errors
    AI_IMAGE_PROVIDER: 'openai',
    OPENAI_IMAGE_MODEL: 'gpt-image-1',
    // Use OPENAI_API_KEY as fallback for image key
    OPENAI_API_KEY: 'dummy-openai-key',
    ...overrides,
  })
}

// Fresh import to re-evaluate config under current env
const importAiServer = async () => {
  vi.resetModules()
  return await import('../ai.server')
}

describe('ai.server.ts', () => {
  beforeEach(() => {
    seedBase()
  })

  it('normalizes LM Studio base URL to include /v1 and builds model list with fallbacks', async () => {
    // Provide only model_1; expect 3-length array with fallbacks
    seedBase({
      AI_PROVIDER: 'lmstudio',
      AI_BASE_URL: 'http://127.0.0.1:1234', // missing /v1
      AI_LOCAL_MODEL_1: 'local-primary',
      AI_LOCAL_MODEL_2: '',
      AI_LOCAL_MODEL_3: '',
    })
    const { aiServerEnv, aiServerConfig, getModelByIndex } = await importAiServer()
    expect(aiServerEnv.AI_PROVIDER).toBe('lmstudio')
    expect(aiServerEnv.baseUrl).toBe('http://127.0.0.1:1234/v1')
    expect(aiServerEnv.models).toEqual(['local-primary', 'local-primary', 'local-primary'])
    // getModelByIndex bounds (1-based)
    expect(getModelByIndex(1)).toBe('local-primary')
    expect(getModelByIndex(2)).toBe('local-primary')
    expect(getModelByIndex(99)).toBe('local-primary') // clamped
    // facade mirrors
    expect(aiServerConfig.modelName).toBe('local-primary')
  })

  it('throws if AI_PROVIDER=openai without OPENAI_API_KEY (chat provider requirement)', async () => {
    seedBase({
      AI_PROVIDER: 'openai',
    })
    delete process.env.OPENAI_API_KEY
    await expect(importAiServer()).rejects.toThrow(/OPENAI_API_KEY is required when AI_PROVIDER=openai/i)
  })

  it('derives visionModel from provider (fallbacks to primary chat model when unspecified)', async () => {
    // OpenAI path: no AI_OPENAI_VISION_MODEL => fallback to AI_OPENAI_MODEL_1
    seedBase({
      AI_PROVIDER: 'openai',
      OPENAI_API_KEY: 'key',
      AI_OPENAI_MODEL_1: 'gpt-4o-mini',
      AI_OPENAI_VISION_MODEL: '',
    })
    const { aiServerEnv } = await importAiServer()
    expect(aiServerEnv.visionModel).toBe('gpt-4o-mini')

    // LM Studio path: fallback to AI_LOCAL_MODEL_1
    seedBase({
      AI_PROVIDER: 'lmstudio',
      AI_BASE_URL: 'http://localhost:1234',
      AI_LOCAL_MODEL_1: 'my-local',
      AI_LOCAL_VISION_MODEL: '',
    })
    const { aiServerEnv: env2 } = await importAiServer()
    expect(env2.visionModel).toBe('my-local')
  })

  it('validates image provider requirements: openai needs an API key and model', async () => {
    // When AI_IMAGE_PROVIDER=openai and both keys missing, should throw
    seedBase({
      AI_IMAGE_PROVIDER: 'openai',
    })
    delete process.env.OPENAI_API_KEY
    delete process.env.OPENAI_IMAGE_API_KEY
    delete process.env.OPENAI_IMAGE_MODEL
    await expect(importAiServer()).rejects.toThrow(/OPENAI_IMAGE_API_KEY or OPENAI_API_KEY is required/i)
  })

  it('supports image provider openai when a key is present (either OPENAI_IMAGE_API_KEY or OPENAI_API_KEY)', async () => {
    seedBase({
      AI_IMAGE_PROVIDER: 'openai',
      OPENAI_API_KEY: 'root-openai-key', // fallback for image key
      OPENAI_IMAGE_MODEL: 'gpt-image-1',
      OPENAI_IMAGE_API_KEY: '', // missing, so fallback to OPENAI_API_KEY
    })
    const { aiServerEnv } = await importAiServer()
    expect(aiServerEnv.OPENAI_IMAGE_API_KEY).toBe('root-openai-key')
  })

  it('propagates requiresJwt from ai.public.ts (NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT)', async () => {
    seedBase({
      NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT: 'true',
    })
    const { aiServerConfig } = await importAiServer()
    expect(aiServerConfig.requiresJwt).toBe(true)
  })

  it('respects max tokens/duration defaults and temperature passthrough', async () => {
    seedBase({
      AI_CHAT_MAX_OUTPUT_TOKENS: '4096',
      AI_CHAT_MAX_DURATION: '45',
      AI_TEMPERATURE: '0.7',
    })
    const { aiServerEnv, aiServerConfig } = await importAiServer()
    expect(aiServerEnv.AI_CHAT_MAX_OUTPUT_TOKENS).toBe(4096)
    expect(aiServerEnv.AI_CHAT_MAX_DURATION).toBe(45)
    expect(aiServerEnv.AI_TEMPERATURE).toBe(0.7)
    expect(aiServerConfig.limits.maxOutputTokens).toBe(4096)
    expect(aiServerConfig.limits.maxDurationSec).toBe(45)
    expect(aiServerConfig.temperature).toBe(0.7)
  })
})
