// app/lib/llm/__tests__/registry.test.ts

const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock('@logger', () => ({
  createLogger: vi.fn(() => mockLogger),
}));

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation((config) => ({
    modelName: config.modelName,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    streaming: config.streaming,
    openAIApiKey: config.openAIApiKey,
    configuration: config.configuration,
    _llmType: () => 'openai',
  })),
}));

// Mock config inline with values we can control per test
const createMockConfig = (overrides = {}) => ({
  provider: 'lmstudio',
  models: ['test-model'],
  modelName: 'test-model',
  getModel: vi.fn((index) => `test-model-${index}`),
  baseUrl: 'http://test:1234/v1',
  temperature: undefined,
  limits: { maxOutputTokens: 2000, maxDurationSec: 30 },
  quota: { enabled: false, tokens: 20000, windowSec: 86400, active: false },
  cryptoQuota: { enabled: true, dailyLimitEth: 0, perUserLimitEth: 0, durationSec: 86400 },
  requiresJwt: false,
  redisActive: false,
  quotaReset: { enabled: false },
  secrets: { openaiApiKey: undefined, quotaResetSecret: '', aiPrivateKey: undefined },
  image: {
    provider: 'openai',
    openai: { model: 'test-image', apiKey: undefined },
    replicate: { apiToken: undefined },
    huggingface: { apiToken: undefined, model: undefined, baseUrl: 'https://test' },
    defaults: { size: '1024x1024', quality: 'medium', maxConcurrency: 4, maxDurationSec: 60 },
    supportsImageGeneration: true,
  },
  vision: { provider: 'lmstudio', model: 'test-model' },
  ...overrides,
});

import { ChatOpenAI } from '@langchain/openai';

describe('ProviderRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates provider with config', async () => {
    vi.doMock('@/app/config/ai.server', () => ({
      aiServerConfig: createMockConfig(),
    }));

    vi.resetModules();
    const { providerRegistry } = await import('../providers/registry');
    providerRegistry.getProvider();

    expect(ChatOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        modelName: 'test-model',
        maxTokens: 2000,
        streaming: true,
      })
    );
  });

  it('includes temperature when set', async () => {
    vi.doMock('@/app/config/ai.server', () => ({
      aiServerConfig: createMockConfig({ temperature: 0.7 }),
    }));

    vi.resetModules();
    const { providerRegistry } = await import('../providers/registry');
    providerRegistry.getProvider();

    expect(ChatOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.7 })
    );
  });

  it('excludes temperature when undefined', async () => {
    vi.doMock('@/app/config/ai.server', () => ({
      aiServerConfig: createMockConfig({ temperature: undefined }),
    }));

    vi.resetModules();
    const { providerRegistry } = await import('../providers/registry');
    providerRegistry.getProvider();

    const config = (ChatOpenAI as any).mock.calls[0][0];
    expect(config.temperature).toBeUndefined();
  });

  it('overrides model', async () => {
    vi.doMock('@/app/config/ai.server', () => ({
      aiServerConfig: createMockConfig(),
    }));

    vi.resetModules();
    const { providerRegistry } = await import('../providers/registry');
    const llm = providerRegistry.getProvider({ model: 'custom' }) as any;

    expect(llm.modelName).toBe('custom');
  });

  it('overrides temperature', async () => {
    vi.doMock('@/app/config/ai.server', () => ({
      aiServerConfig: createMockConfig(),
    }));

    vi.resetModules();
    const { providerRegistry } = await import('../providers/registry');
    const llm = providerRegistry.getProvider({ temperature: 0.9 }) as any;

    expect(llm.temperature).toBe(0.9);
  });

  it('returns provider info', async () => {
    vi.doMock('@/app/config/ai.server', () => ({
      aiServerConfig: createMockConfig(),
    }));

    vi.resetModules();
    const { providerRegistry } = await import('../providers/registry');
    const info = providerRegistry.getProviderInfo();

    expect(info.provider).toBe('lmstudio');
    expect(info.models).toEqual(['test-model']);
  });
});