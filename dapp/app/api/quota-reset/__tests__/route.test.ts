// app/api/quota-reset/__tests__/route.test.ts

// --- Hoisted state used inside vi.mock factories ---
const h = vi.hoisted(() => {
  return {
    loggerSpy: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },

    // Mutable config objects used by the route
    aiConfig: {
      quotaReset: { enabled: true },
      secrets: { quotaResetSecret: 's3cr3t' },
    },
    serverCfg: {
      stateService: { isActive: true, url: 'https://worker/state', apiKey: 'test-key' },
    },

    // Quota helper spies
    resetAllQuotasMock: vi.fn(),
    resetManyTokenQuotasMock: vi.fn(),
    resetAllCryptoQuotasMock: vi.fn(),
    resetCryptoQuotasByAddressesMock: vi.fn(),
  };
});

// --- Mocks that reference hoisted state ---
vi.mock('@logger', () => ({
  createLogger: () => h.loggerSpy,
}));

vi.mock('@config/ai.server', () => ({
  aiServerConfig: h.aiConfig,
}));

vi.mock('@config/server.env', () => ({
  serverConfig: h.serverCfg,
}));

vi.mock('@lib/quotas/token-quota', () => ({
  resetAllQuotas: h.resetAllQuotasMock,
  resetManyTokenQuotas: h.resetManyTokenQuotasMock,
}));

vi.mock('@lib/quotas/crypto-quota', () => ({
  resetAllCryptoQuotas: h.resetAllCryptoQuotasMock,
  resetCryptoQuotasByAddresses: h.resetCryptoQuotasByAddressesMock,
}));

// Import after mocks are set up
import { POST } from '../route';
import { aiServerConfig } from '@config/ai.server';
import { serverConfig } from '@config/server.env';

// Local refs to hoisted state for assertions & resets
const loggerSpy = h.loggerSpy;
const resetAllQuotasMock = h.resetAllQuotasMock;
const resetManyTokenQuotasMock = h.resetManyTokenQuotasMock;
const resetAllCryptoQuotasMock = h.resetAllCryptoQuotasMock;
const resetCryptoQuotasByAddressesMock = h.resetCryptoQuotasByAddressesMock;

// --- Small helpers ---

function makeReq(options?: {
  url?: string;
  headers?: Record<string, string>;
  body?: any;
}) {
  const url = options?.url ?? 'https://example.com/api/quota-reset';
  const headers = new Headers(options?.headers ?? {});
  const body = options?.body ?? {};
  return {
    url,
    headers,
    json: async () => body,
  } as any; // minimal NextRequest-like object sufficient for this route
}

async function parse(res: Response) {
  const json = await res.json().catch(() => ({}));
  const why = res.headers.get('X-Why');
  return { status: res.status, json, why };
}

// --- Tests ---

describe('POST /api/quota-reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // reset mocked config (cast to any to avoid readonly typing complaints)
    (aiServerConfig as any).quotaReset.enabled = true;
    (aiServerConfig as any).secrets.quotaResetSecret = 's3cr3t';
    (serverConfig as any).stateService.isActive = true;

    resetAllQuotasMock.mockResolvedValue({ deleted: 5, keys: ['k1', 'k2'] });
    resetManyTokenQuotasMock.mockResolvedValue({ deleted: 3, keys: ['t1', 't2', 't3'] });
    resetAllCryptoQuotasMock.mockResolvedValue({ deleted: 2, keys: ['c1', 'c2'] });
    resetCryptoQuotasByAddressesMock.mockResolvedValue({
      deleted: 2,
      network: 'mainnet',
      keys: ['a1', 'a2'],
    });
  });

  it('returns 403 when feature disabled', async () => {
    (aiServerConfig as any).quotaReset.enabled = false;

    const res = await POST(makeReq({ body: {} }));
    const out = await parse(res);

    expect(out.status).toBe(403);
    expect(out.json).toEqual({ error: 'Quota reset disabled' });
    expect(loggerSpy.warn).toHaveBeenCalledWith('quota_reset_disabled', { enabled: false });
  });

  it('returns 503 when state service inactive', async () => {
    (serverConfig as any).stateService.isActive = false;

    const res = await POST(makeReq({ body: {} }));
    const out = await parse(res);

    expect(out.status).toBe(503);
    expect(out.json).toEqual({ error: 'State service inactive' });
    expect(loggerSpy.warn).toHaveBeenCalledWith('quota_reset_state_service_inactive');
  });

  it('returns 401 when secret missing', async () => {
    const res = await POST(makeReq({ body: {} }));
    const out = await parse(res);

    expect(out.status).toBe(401);
    expect(out.json).toEqual({ error: 'Unauthorized' });
    expect(out.why).toBe('missing-secret');
  });

  it('returns 401 when secret mismatched', async () => {
    const res = await POST(
      makeReq({
        headers: { 'x-quota-reset-secret': 'wrong' },
        body: {},
      }),
    );
    const out = await parse(res);

    expect(out.status).toBe(401);
    expect(out.json).toEqual({ error: 'Unauthorized' });
    expect(out.why).toBe('mismatch');
  });

  it('accepts Authorization: Bearer secret', async () => {
    const res = await POST(
      makeReq({
        headers: { Authorization: 'Bearer s3cr3t' },
        body: { all: true, scope: 'token' },
      }),
    );
    const out = await parse(res);

    expect(out.status).toBe(200);
    expect(out.json.ok).toBe(true);
    expect(out.json.scope).toBe('token');
    expect(out.json.mode).toBe('all');
    expect(resetAllQuotasMock).toHaveBeenCalledTimes(1);
  });

  it('token scope: all=true calls resetAllTokenQuotas', async () => {
    const res = await POST(
      makeReq({
        headers: { 'x-quota-reset-secret': 's3cr3t' },
        body: { all: true, scope: 'token' },
      }),
    );
    const out = await parse(res);

    expect(out.status).toBe(200);
    expect(out.json).toMatchObject({
      ok: true,
      scope: 'token',
      mode: 'all',
      token: { deleted: 5, keys: ['k1', 'k2'] },
    });
    expect(resetAllQuotasMock).toHaveBeenCalledTimes(1);
  });

  it('crypto scope: all=true calls resetAllCryptoQuotas', async () => {
    const res = await POST(
      makeReq({
        headers: { 'x-quota-reset-secret': 's3cr3t' },
        body: { all: true, scope: 'crypto' },
      }),
    );
    const out = await parse(res);

    expect(out.status).toBe(200);
    expect(out.json).toMatchObject({
      ok: true,
      scope: 'crypto',
      mode: 'all',
      crypto: { deleted: 2, keys: ['c1', 'c2'] },
    });
    expect(resetAllCryptoQuotasMock).toHaveBeenCalledTimes(1);
  });

  it('both scope: all=true calls both resetters', async () => {
    const res = await POST(
      makeReq({
        headers: { 'x-quota-reset-secret': 's3cr3t' },
        body: { all: true, scope: 'both' },
      }),
    );
    const out = await parse(res);

    expect(out.status).toBe(200);
    expect(out.json).toMatchObject({
      ok: true,
      scope: 'both',
      mode: 'all',
      token: { deleted: 5 },
      crypto: { deleted: 2 },
    });
    expect(resetAllQuotasMock).toHaveBeenCalledTimes(1);
    expect(resetAllCryptoQuotasMock).toHaveBeenCalledTimes(1);
  });

  it('token scope: tokenIds array calls resetManyTokenQuotas', async () => {
    const res = await POST(
      makeReq({
        headers: { 'x-quota-reset-secret': 's3cr3t' },
        body: { tokenIds: [1, ' 2 ', 3] }, // scope defaults to token if tokenIds present
      }),
    );
    const out = await parse(res);

    expect(out.status).toBe(200);
    expect(out.json).toMatchObject({
      ok: true,
      scope: 'token',
      mode: 'ids',
      token: { deleted: 3 },
    });
    expect(resetManyTokenQuotasMock).toHaveBeenCalledWith([1, '2', 3]);
  });

  it('token scope: missing tokenIds -> 400', async () => {
    const res = await POST(
      makeReq({
        headers: { 'x-quota-reset-secret': 's3cr3t' },
        body: { tokenIds: [] },
      }),
    );
    const out = await parse(res);

    expect(out.status).toBe(400);
    expect(out.json).toEqual({
      error: 'Provide { all: true } or a non-empty tokenIds[] array',
    });
    expect(resetManyTokenQuotasMock).not.toHaveBeenCalled();
  });

  it('crypto scope: addresses array calls resetCryptoQuotasByAddresses', async () => {
    const res = await POST(
      makeReq({
        headers: { 'x-quota-reset-secret': 's3cr3t' },
        body: { scope: 'crypto', addresses: [' 0xabc ', '', '0xdef'] },
      }),
    );
    const out = await parse(res);

    expect(out.status).toBe(200);
    expect(out.json).toMatchObject({
      ok: true,
      scope: 'crypto',
      mode: 'addresses',
      crypto: { deleted: 2, network: 'mainnet' },
    });
    expect(resetCryptoQuotasByAddressesMock).toHaveBeenCalledWith(['0xabc', '0xdef']);
  });

  it('crypto scope: missing addresses -> 400', async () => {
    const res = await POST(
      makeReq({
        headers: { 'x-quota-reset-secret': 's3cr3t' },
        body: { scope: 'crypto', addresses: [] },
      }),
    );
    const out = await parse(res);

    expect(out.status).toBe(400);
    expect(out.json).toEqual({
      error: 'Provide { all: true } or a non-empty addresses[] array',
    });
    expect(resetCryptoQuotasByAddressesMock).not.toHaveBeenCalled();
  });
});
