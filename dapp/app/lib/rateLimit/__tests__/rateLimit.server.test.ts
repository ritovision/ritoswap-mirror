// app/lib/rateLimit/__tests__/rateLimit.server.test.ts
/**
 * @vitest-environment node
 */

// ── HOISTED MOCKS: must precede imports ───────────────────────────────────────
vi.mock('@logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@config/public.env', () => {
  const buildPublicEnv = () => ({
    NEXT_PUBLIC_ENABLE_STATE_WORKER: process.env.NEXT_PUBLIC_ENABLE_STATE_WORKER === 'true',
    NEXT_PUBLIC_DOMAIN: process.env.NEXT_PUBLIC_DOMAIN || 'localhost:3000',
  });
  const buildPublicConfig = () => ({
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: !process.env.NODE_ENV || process.env.NODE_ENV === 'test',
    environment: process.env.NODE_ENV || 'test',
  });
  return {
    get publicEnv() {
      return buildPublicEnv();
    },
    get publicConfig() {
      return buildPublicConfig();
    },
  };
});

const mockStateClient = {
  storeNonce: vi.fn(),
  getNonce: vi.fn(),
  consumeNonce: vi.fn(),
  checkRateLimit: vi.fn(),
  ensureQuotaWindow: vi.fn(),
  incrementQuotaUsage: vi.fn(),
  incrementQuotaBatch: vi.fn(),
  resetQuotaKeys: vi.fn(),
  resetQuotaPrefix: vi.fn(),
};

let mockStateServiceEnabled = true;

vi.mock('@/app/lib/state/client', () => ({
  getStateClient: () => mockStateClient,
  isStateServiceEnabled: () => mockStateServiceEnabled,
}));

// ── Imports (safe after mocks) ────────────────────────────────────────────────
import { NextRequest } from 'next/server';
import {
  resetModulesAndSeed,
  seedServerTest,
  seedStateWorkerOn,
  seedStateWorkerOff,
} from '../../../../test/helpers/env';

describe('rateLimit.server.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(mockStateClient).forEach((fn) => {
      if (typeof fn === 'function') {
        fn.mockReset?.();
      }
    });
    mockStateServiceEnabled = true;
    seedServerTest();
    seedStateWorkerOn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isRateLimitEnabled', () => {
    it('returns true when state worker is fully configured', async () => {
      resetModulesAndSeed(seedServerTest);
      seedStateWorkerOn();

      const { isRateLimitEnabled } = await import('../rateLimit.server');
      expect(isRateLimitEnabled()).toBe(true);
    });

    it('returns false when the public flag is disabled', async () => {
      resetModulesAndSeed(seedServerTest);
      seedStateWorkerOff();

      const { isRateLimitEnabled } = await import('../rateLimit.server');
      expect(isRateLimitEnabled()).toBe(false);
    });

    it('returns false when worker URL is missing', async () => {
      resetModulesAndSeed(seedServerTest, {
        NEXT_PUBLIC_ENABLE_STATE_WORKER: 'true',
        STATE_WORKER_API_KEY: 'test-key',
      });

      const { isRateLimitEnabled } = await import('../rateLimit.server');
      expect(isRateLimitEnabled()).toBe(false);
    });

    it('returns false when the state service reports unavailable', async () => {
      mockStateServiceEnabled = false;
      const { isRateLimitEnabled } = await import('../rateLimit.server');
      expect(isRateLimitEnabled()).toBe(false);
    });
  });

  describe('getIdentifier', () => {
    it('prefers x-forwarded-for header', async () => {
      const { getIdentifier } = await import('../rateLimit.server');
      const req = new NextRequest('https://example.com', {
        headers: { 'x-forwarded-for': '10.0.0.1, 172.16.0.5' },
      });
      expect(getIdentifier(req)).toBe('10.0.0.1');
    });

    it('falls back to local identifier in development', async () => {
      resetModulesAndSeed(seedServerTest, { NODE_ENV: 'development' });
      seedStateWorkerOn();

      const { getIdentifier } = await import('../rateLimit.server');
      const req = new NextRequest('https://example.com');
      expect(getIdentifier(req)).toBe('127.0.0.1');
    });
  });

  describe('checkRateLimitWithNonce', () => {
    it('returns success when rate limiting is disabled', async () => {
      resetModulesAndSeed(seedServerTest);
      seedStateWorkerOff();
      mockStateServiceEnabled = false;

      const { checkRateLimitWithNonce } = await import('../rateLimit.server');
      const req = new NextRequest('https://example.com');
      const result = await checkRateLimitWithNonce(req, 'nonce');
      expect(result).toEqual({ success: true });
    });

    it('invokes the state client for limiter + global checks', async () => {
      const now = Date.now();
      mockStateClient.checkRateLimit
        .mockResolvedValueOnce({ success: true, limit: 30, remaining: 29, reset: now + 60_000 })
        .mockResolvedValueOnce({ success: true, limit: 200, remaining: 199, reset: now + 3_600_000 });
      mockStateClient.getNonce.mockResolvedValue('cached-nonce');

      const { checkRateLimitWithNonce } = await import('../rateLimit.server');
      const req = new NextRequest('https://example.com', {
        headers: { 'x-forwarded-for': '192.168.0.2' },
      });

      const result = await checkRateLimitWithNonce(req, 'nonce');
      expect(result.success).toBe(true);
      expect(result.nonce).toBe('cached-nonce');
      expect(mockStateClient.checkRateLimit).toHaveBeenCalledTimes(2);
      expect(mockStateClient.checkRateLimit).toHaveBeenCalledWith({
        limiter: 'nonce',
        identifier: '192.168.0.2',
        limit: 30,
        windowSeconds: 60,
      });
    });

    it('short-circuits when limiter rejects', async () => {
      mockStateClient.checkRateLimit.mockResolvedValueOnce({
        success: false,
        limit: 30,
        remaining: 0,
        reset: Date.now() + 60_000,
      });

      const { checkRateLimitWithNonce } = await import('../rateLimit.server');
      const req = new NextRequest('https://example.com');
      const result = await checkRateLimitWithNonce(req, 'nonce');

      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
      expect(mockStateClient.checkRateLimit).toHaveBeenCalledTimes(1);
    });

    it('returns failure when global limiter rejects', async () => {
      const now = Date.now();
      mockStateClient.checkRateLimit
        .mockResolvedValueOnce({ success: true, limit: 60, remaining: 59, reset: now + 60_000 })
        .mockResolvedValueOnce({ success: false, limit: 200, remaining: 0, reset: now + 3_600_000 });

      const { checkRateLimitWithNonce } = await import('../rateLimit.server');
      const req = new NextRequest('https://example.com');
      const result = await checkRateLimitWithNonce(req, 'gateAccess');

      expect(result.success).toBe(false);
      expect(result.limit).toBe(200);
      expect(mockStateClient.checkRateLimit).toHaveBeenCalledTimes(2);
    });
  });
});
