import type { QuotaWindow } from '@/app/lib/state/types';

const stateStore = new Map<string, QuotaWindow>();

const mockStateClient = {
  storeNonce: vi.fn(),
  getNonce: vi.fn(),
  consumeNonce: vi.fn(),
  checkRateLimit: vi.fn(),
  ensureQuotaWindow: vi.fn(
    async (key: string, limit: number, duration: number): Promise<QuotaWindow> => {
      const existing = stateStore.get(key);
      if (existing) return existing;
      const now = Math.floor(Date.now() / 1000);
      const window = { limit, used: 0, duration, resetAt: now + duration };
      stateStore.set(key, window);
      return window;
    },
  ),
  incrementQuotaUsage: vi.fn(),
  incrementQuotaBatch: vi.fn(async (entries: Array<{ key: string; amount: number }>) => {
    for (const entry of entries) {
      const window = stateStore.get(entry.key);
      if (!window) throw new Error('missing window');
      window.used += entry.amount;
    }
  }),
  resetQuotaKeys: vi.fn(async (keys: string[]) => {
    let deleted = 0;
    for (const key of keys) {
      if (stateStore.delete(key)) deleted += 1;
    }
    return { deleted, keys };
  }),
  resetQuotaPrefix: vi.fn(async (prefix: string) => {
    const keys = Array.from(stateStore.keys()).filter((k) => k.startsWith(prefix));
    keys.forEach((k) => stateStore.delete(k));
    return { deleted: keys.length, keys };
  }),
};

let mockStateServiceEnabled = true;

const loggerFns = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const mockState = {
  ai: {
    cryptoQuota: {
      enabled: true,
      dailyLimitEth: 10,
      perUserLimitEth: 2,
      durationSec: 3600,
    },
  },
  server: {
    stateService: {
      isActive: true,
      url: 'https://worker.example.dev/state',
      apiKey: 'test',
    },
  },
  chainId: 11155111,
};

vi.mock('server-only', () => ({}));

vi.mock('@/app/lib/state/client', () => ({
  getStateClient: () => mockStateClient,
  isStateServiceEnabled: () => mockStateServiceEnabled,
}));

vi.mock('@logger', () => ({
  createLogger: () => loggerFns,
}));

vi.mock('@config/server.env', () => ({ serverConfig: mockState.server }));
vi.mock('@config/ai.server', () => ({ aiServerConfig: mockState.ai }));
vi.mock('@config/chain', () => ({
  getChainConfig: () => ({ chainId: mockState.chainId }),
}));
vi.mock('@/app/lib/mcp/utils/chains', () => ({
  CHAIN_IDS: {
    Ethereum: 1,
    Sepolia: 11155111,
    Ritonet: 777777,
  },
}));

async function loadModule() {
  vi.resetModules();
  const mod = await import('../crypto-quota');
  return mod;
}

describe('crypto-quota', () => {
  beforeEach(() => {
    stateStore.clear();
    mockState.ai.cryptoQuota = {
      enabled: true,
      dailyLimitEth: 10,
      perUserLimitEth: 2,
      durationSec: 3600,
    };
    mockState.server.stateService.isActive = true;
    mockStateServiceEnabled = true;
    Object.values(loggerFns).forEach((fn) => fn.mockClear());
    Object.values(mockStateClient).forEach((fn) => {
      (fn as any)?.mockClear?.();
    });
  });

  it('activates only when feature + worker active', async () => {
    let mod = await loadModule();
    expect(mod.isCryptoQuotaFeatureActive()).toBe(true);

    mockState.ai.cryptoQuota.enabled = false;
    mod = await loadModule();
    expect(mod.isCryptoQuotaFeatureActive()).toBe(false);

    mockState.ai.cryptoQuota.enabled = true;
    mockState.server.stateService.isActive = false;
    mod = await loadModule();
    expect(mod.isCryptoQuotaFeatureActive()).toBe(false);
  });

  it('precheck returns remaining amounts and reason codes', async () => {
    const mod = await loadModule();
    const res = await mod.precheckCryptoSpend('0xabc', 1.5);

    expect(res.allowed).toBe(true);
    expect(res.remainingGlobalEth).toBeCloseTo(10, 6);
    expect(res.remainingUserEth).toBeCloseTo(2, 6);
    expect(res.network).toBe('Sepolia');
  });

  it('recordCryptoSpend updates both global and user windows', async () => {
    const mod = await loadModule();
    await mod.precheckCryptoSpend('0xabc', 0.1);
    await mod.recordCryptoSpend('0xabc', 1.2);

    const res = await mod.precheckCryptoSpend('0xabc', 0.1);
    expect(res.remainingGlobalEth).toBeCloseTo(10 - 1.2, 6);
    expect(res.remainingUserEth).toBeCloseTo(2 - 1.2, 6);
  });

  it('blocks when user quota exhausted', async () => {
    mockState.ai.cryptoQuota.perUserLimitEth = 1;
    const mod = await loadModule();
    await mod.precheckCryptoSpend('0xuser', 0.1);
    await mod.recordCryptoSpend('0xuser', 1);

    const res = await mod.precheckCryptoSpend('0xuser', 0.5);
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('user_exhausted');
  });

  it('resetCryptoQuotasByAddresses removes address windows', async () => {
    const mod = await loadModule();
    await mod.precheckCryptoSpend('0x111', 0.1);
    await mod.precheckCryptoSpend('0x222', 0.1);

    const res = await mod.resetCryptoQuotasByAddresses(['0x111']);
    expect(res.deleted).toBeGreaterThan(0);
    expect(mockStateClient.resetQuotaKeys).toHaveBeenCalled();
  });

  it('resetAllCryptoQuotas clears all matching keys', async () => {
    const mod = await loadModule();
    await mod.precheckCryptoSpend('0x333', 0.1);
    const res = await mod.resetAllCryptoQuotas();
    expect(res.deleted).toBeGreaterThanOrEqual(2); // global + addr entries
    expect(mockStateClient.resetQuotaPrefix).toHaveBeenCalledWith('crypto:quota');
  });
});
