import type { QuotaWindow } from '@/app/lib/state/types';

const stateStore = new Map<string, QuotaWindow>();

const loggerFns = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

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
  incrementQuotaUsage: vi.fn(async (key: string, amount: number) => {
    const window = stateStore.get(key);
    if (!window) throw new Error('missing window');
    window.used += amount;
    const remaining = Math.max(0, window.limit - window.used);
    return { used: window.used, remaining };
  }),
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

vi.mock('server-only', () => ({}));

vi.mock('@/app/lib/state/client', () => ({
  getStateClient: () => mockStateClient,
  isStateServiceEnabled: () => mockStateServiceEnabled,
}));

vi.mock('@logger', () => ({
  createLogger: () => loggerFns,
}));

const mockState = {
  ai: {
    quota: { enabled: true, tokens: 20000, windowSec: 3600 },
  },
  server: {
    stateService: {
      isActive: true,
      url: 'https://worker.example.dev/state',
      apiKey: 'test',
    },
  },
};

vi.mock('@config/server.env', () => ({ serverConfig: mockState.server }));
vi.mock('@config/ai.server', () => ({ aiServerConfig: mockState.ai }));

async function loadModule() {
  vi.resetModules();
  const mod = await import('../token-quota');
  return mod;
}

describe('token-quota', () => {
  beforeEach(() => {
    stateStore.clear();
    Object.values(loggerFns).forEach((fn) => fn.mockClear());
    Object.values(mockStateClient).forEach((fn) => {
      (fn as any)?.mockClear?.();
    });
    mockState.ai.quota = { enabled: true, tokens: 20000, windowSec: 3600 };
    mockState.server.stateService.isActive = true;
    mockStateServiceEnabled = true;
  });

  it('activates only when quota + state worker are ready', async () => {
    let mod = await loadModule();
    expect(mod.isQuotaFeatureActive()).toBe(true);

    mockState.ai.quota.enabled = false;
    mod = await loadModule();
    expect(mod.isQuotaFeatureActive()).toBe(false);

    mockState.ai.quota.enabled = true;
    mockState.server.stateService.isActive = false;
    mod = await loadModule();
    expect(mod.isQuotaFeatureActive()).toBe(false);
  });

  it('ensureWindow delegates to the state client and returns defaults', async () => {
    const mod = await loadModule();
    const win = await mod.ensureWindow('tokA');
    expect(win.limit).toBe(20000);
    expect(win.used).toBe(0);
    expect(win.duration).toBe(3600);
    expect(mockStateClient.ensureQuotaWindow).toHaveBeenCalledWith('chat:quota:tokA', 20000, 3600);
  });

  it('ensureWindow falls back to unlimited when feature disabled', async () => {
    mockState.ai.quota.enabled = false;
    const mod = await loadModule();
    const win = await mod.ensureWindow('tokB');
    expect(win.limit).toBe(Number.MAX_SAFE_INTEGER);
    expect(mockStateClient.ensureQuotaWindow).not.toHaveBeenCalled();
  });

  it('ensureAndCheck reports allowance correctly', async () => {
    const mod = await loadModule();
    await mod.ensureWindow('tokC', { limit: 5 });

    const c1 = await mod.ensureAndCheck('tokC');
    expect(c1.allowed).toBe(true);
    expect(c1.remaining).toBe(5);

    await mod.addUsage('tokC', 3);
    const c2 = await mod.ensureAndCheck('tokC');
    expect(c2.allowed).toBe(true);
    expect(c2.remaining).toBe(2);
  });

  it('addUsage uses ceil(amount) and returns usage summary', async () => {
    const mod = await loadModule();
    await mod.ensureWindow('tokD', { limit: 10 });

    const r1 = await mod.addUsage('tokD', 1.2);
    expect(r1).toEqual({ used: 2, remaining: 8 });

    const r2 = await mod.addUsage('tokD', 2.8);
    expect(r2).toEqual({ used: 5, remaining: 5 });
  });

  it('addUsage returns null when disabled', async () => {
    mockState.ai.quota.enabled = false;
    const mod = await loadModule();
    expect(await mod.addUsage('tokE', 3)).toBeNull();
  });

  it('resetTokenQuota deletes matching window', async () => {
    const mod = await loadModule();
    await mod.ensureWindow('tokF');
    const deleted = await mod.resetTokenQuota('tokF');
    expect(deleted).toBe(true);
    expect(mockStateClient.resetQuotaKeys).toHaveBeenCalledWith(['chat:quota:tokF']);
  });

  it('resetAllQuotas uses prefix from options when provided', async () => {
    const mod = await loadModule();
    await mod.ensureWindow('tokG');
    const res = await mod.resetAllQuotas({ matchPrefix: 'chat:quota:' });
    expect(res.deleted).toBeGreaterThanOrEqual(1);
    expect(mockStateClient.resetQuotaPrefix).toHaveBeenCalledWith('chat:quota:');
  });
});
