/// <reference types="vitest/globals" />
import { NextRequest } from 'next/server'
import type { Mock } from 'vitest'

// ensure our email URL is set for both suites (will be overridden by seeding when needed)
process.env.CLOUDFLARE_WORKER_URL = 'https://worker.test'

// Increase hook timeouts a bit to avoid flakiness during dynamic import & env seeding
const HOOK_TIMEOUT = 30_000

// ─── Test constants ───────────────────────────────────────────────────────────
const VALID_ADDR  = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const VALID_SIG   = '0x' + 'a'.repeat(130) // 65-byte hex ECDSA

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
vi.mock('viem', () => ({
  createPublicClient: vi.fn(),
  http:               vi.fn(() => ({})), // dummy transport to satisfy createPublicClient
  verifyMessage:      vi.fn(),
  // include defineChain to prevent undefined imports when the route is evaluated
  defineChain:        vi.fn((def: any) => def),
}))

// Support both alias styles so the route's imports are always mocked
vi.mock('@/app/lib/prisma/prismaNetworkUtils', () => ({
  getTokenModel:  vi.fn(),
  getChainConfig: vi.fn(),
}))
vi.mock('@lib/prisma/prismaNetworkUtils', () => ({
  getTokenModel:  vi.fn(),
  getChainConfig: vi.fn(),
}))

vi.mock('@/app/config/contracts', () => ({
  fullKeyTokenAbi:     [],
  KEY_TOKEN_ADDRESS: '0xContract',
}))
vi.mock('@config/contracts', () => ({
  fullKeyTokenAbi:     [],
  KEY_TOKEN_ADDRESS: '0xContract',
}))

vi.mock('@/app/lib/rateLimit/rateLimit.server', () => ({
  checkRateLimitWithNonce: vi.fn(),
}))
vi.mock('@lib/rateLimit/rateLimit.server', () => ({
  checkRateLimitWithNonce: vi.fn(),
}))

// Avoid any side-effects from the backdoor reset scheduler
vi.mock('@lib/backdoorToken/BackdoorToken', () => ({
  scheduleTokenReset: vi.fn(async () => {}),
}))

// ─── Imports used in tests (safe, not the route yet) ──────────────────────────
import { createPublicClient, verifyMessage } from 'viem'
import {
  getTokenModel,
  getChainConfig,
} from '@/app/lib/prisma/prismaNetworkUtils'
import { checkRateLimitWithNonce } from '@/app/lib/rateLimit/rateLimit.server'

// Centralized env helper (this file globally mocks @config/server.env)
import {
  resetModulesAndSeed,
  seedServerTest,
  saveEnv,
  restoreEnv,
} from '../../../../test/helpers/env'

// ─── Utilities ────────────────────────────────────────────────────────────────
let POSTCurrent: (req: NextRequest) => Promise<Response>
let GETCurrent: (req: NextRequest) => Promise<Response> | Response
let PUTCurrent: (req: NextRequest) => Promise<Response> | Response
let DELETECurrent: (req: NextRequest) => Promise<Response> | Response
let PATCHCurrent: (req: NextRequest) => Promise<Response> | Response
let HEADCurrent: (req: NextRequest) => Promise<Response> | Response

const makeReq = (body: unknown, host = 'localhost:3000'): Promise<Response> => {
  const init =
    typeof body === 'string'
      ? ({
          method: 'POST',
          headers: { 'x-forwarded-host': host },
          body,
        } as any)
      : ({
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-forwarded-host': host },
          body: JSON.stringify(body),
        } as any)

  const req = new NextRequest(`http://${host}/api/form-submission-gate`, init)
  return POSTCurrent(req as any)
}

const makeReqAnyMethod = async (
  method: 'GET'|'PUT'|'DELETE'|'PATCH'|'HEAD',
  host = 'localhost:3000'
): Promise<Response> => {
  const req = new NextRequest(`http://${host}/api/form-submission-gate`, {
    method,
    headers: { 'x-forwarded-host': host },
  } as any)
  const handler =
    method === 'GET'    ? GETCurrent :
    method === 'PUT'    ? PUTCurrent :
    method === 'DELETE' ? DELETECurrent :
    method === 'PATCH'  ? PATCHCurrent :
                          HEADCurrent
  // handler may be sync; normalize to Promise
  return Promise.resolve(handler(req as any) as any)
}

// Consistent Sepolia chain config mock to match refactor & other test suite
function mockSepoliaChain() {
  vi.mocked(getTokenModel) // noop to keep import
  vi.mocked(getChainConfig).mockReturnValue({
    chainId: 11155111,
    name: 'sepolia',
    rpcUrl: 'http://rpc',
    wssUrl: undefined,
    explorerUrl: undefined,
    explorerName: 'TestScan',
    isTestnet: true,
    chain: {
      id: 11155111,
      name: 'sepolia',
      network: 'sepolia',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: ['http://rpc'] },
        public:  { http: ['http://rpc'] },
      },
    },
    transport: 'http://rpc',
  } as any)
}

// ─── Suites ───────────────────────────────────────────────────────────────────

describe('POST /api/form-submission-gate (dev mode)', () => {
  let tokenModel: { findUnique: Mock; upsert: Mock }
  let mockClient: { readContract: Mock }
  const now = Date.now()
  let savedEnv: NodeJS.ProcessEnv

  beforeAll(async () => {
    savedEnv = saveEnv()
    // Test mode (not production). Domain allowlist optional in this route anyway.
    resetModulesAndSeed(seedServerTest, {
      NEXT_PUBLIC_DOMAIN: 'localhost:3000',
      NEXT_PUBLIC_ACTIVE_CHAIN: 'sepolia',
      NODE_ENV: 'test',
    })
    const route = await import('../route')
    POSTCurrent   = route.POST
    GETCurrent    = route.GET
    PUTCurrent    = route.PUT
    DELETECurrent = route.DELETE
    PATCHCurrent  = route.PATCH
    HEADCurrent   = route.HEAD
  }, HOOK_TIMEOUT)

  afterAll(() => {
    restoreEnv(savedEnv)
  })

  beforeEach(() => {
    vi.mocked(checkRateLimitWithNonce).mockResolvedValue({ success: true, limit: 5, remaining: 5 })

    tokenModel = { findUnique: vi.fn(), upsert: vi.fn() }
    vi.mocked(getTokenModel).mockReturnValue(tokenModel as any)

    mockSepoliaChain()

    mockClient = { readContract: vi.fn() }
    vi.mocked(createPublicClient).mockReturnValue(mockClient as any)

    vi.mocked(verifyMessage).mockReset()
    delete process.env.NEXT_PUBLIC_DOMAIN // keep allowlist disabled for these tests
  })

  it('429 when rate limit exceeded (with reset timestamp)', async () => {
    // Freeze time so Retry-After is deterministic and not sensitive to runtime jitter.
    vi.useFakeTimers()
    try {
      const base = new Date('2025-01-01T00:00:00.000Z')
      vi.setSystemTime(base)

      const t0 = Date.now()
      const resetTs = t0 + 120_000 // 2 minutes in the future

      vi.mocked(checkRateLimitWithNonce).mockResolvedValueOnce({
        success:   false,
        limit:     10,
        remaining: 0,
        reset:     resetTs,
      })

      const res = await makeReq({
        tokenId:    1,
        message:    'msg',
        signature:  VALID_SIG,
        address:    VALID_ADDR,
        timestamp:  t0,
      })

      expect(res.status).toBe(429)
      expect(res.headers.get('X-RateLimit-Limit')).toBe('10')
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')

      const retryAfter = Number(res.headers.get('Retry-After'))
      // With frozen time, the server computes exactly 120s.
      expect(Number.isFinite(retryAfter)).toBe(true)
      expect(retryAfter).toBe(120)

      const data = await res.json()
      expect(data.title).toBe('Too many requests')
      expect(data.status).toBe(429)
      expect(data.detail).toBe('Rate limit exceeded for form-submission-gate')
      expect(typeof data.limit).toBe('number')
      expect(typeof data.remaining).toBe('number')
      expect(typeof data.retryAfter).toBe('number')
      expect(String(data.type || '')).toMatch(/\/too-many-requests$/)
    } finally {
      vi.useRealTimers()
    }
  })

  it('400: invalid JSON', async () => {
    const res = await makeReq('not a json')
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.title).toBe('Invalid JSON')
    expect(data.status).toBe(400)
    expect(String(data.type || '')).toMatch(/\/invalid-json$/)
    expect(String(data.detail || '')).toContain('parse')
  })

  it('400: missing required fields', async () => {
    const res = await makeReq({ tokenId: 1 })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.title).toBe('Invalid request')
    expect(data.status).toBe(400)
    // zod returns "Required" for missing field
    expect(String(data.detail || '')).toBeTruthy()
  })

  it('400: missing or invalid timestamp field when omitted', async () => {
    const res = await makeReq({
      tokenId:    1,
      message:    'msg',
      signature:  VALID_SIG,
      address:    VALID_ADDR,
      // timestamp omitted
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.title).toBe('Invalid request')
    expect(data.status).toBe(400)
  })

  it('400: missing or invalid timestamp field when null', async () => {
    const res = await makeReq({
      tokenId:    1,
      message:    'msg',
      signature:  VALID_SIG,
      address:    VALID_ADDR,
      timestamp:  null,
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.title).toBe('Invalid request')
    expect(data.status).toBe(400)
  })

  it('400: message too long', async () => {
    const body = {
      tokenId:    1,
      message:    'x'.repeat(10_001),
      signature:  VALID_SIG,
      address:    VALID_ADDR,
      timestamp:  now,
    }
    const res = await makeReq(body)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.title).toBe('Invalid request')
    expect(data.status).toBe(400)
    expect(data.detail).toBe('Message too long')
  })

  it('401: signature expired', async () => {
    const body = {
      tokenId:    1,
      message:    'msg',
      signature:  VALID_SIG,
      address:    VALID_ADDR,
      timestamp:  now - 6 * 60 * 1000, // >5m
    }
    const res = await makeReq(body)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.title).toBe('Authentication failed')
    expect(data.status).toBe(401)
    expect(data.detail).toBe('Signature expired')
  })

  it('401: invalid signature (throws)', async () => {
    vi.mocked(verifyMessage).mockRejectedValueOnce(new Error('bad'))
    const res = await makeReq({
      tokenId:    1,
      message:    'm',
      signature:  VALID_SIG,
      address:    VALID_ADDR,
      timestamp:  now,
    })
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.title).toBe('Authentication failed')
    expect(data.status).toBe(401)
    expect(data.detail).toBe('Invalid signature')
  })

  it('401: invalid signature (false)', async () => {
    vi.mocked(verifyMessage).mockResolvedValueOnce(false)
    const res = await makeReq({
      tokenId:    1,
      message:    'm',
      signature:  VALID_SIG,
      address:    VALID_ADDR,
      timestamp:  now,
    })
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.title).toBe('Authentication failed')
    expect(data.status).toBe(401)
    expect(data.detail).toBe('Invalid signature')
  })

  it('403: ownership mismatch', async () => {
    vi.mocked(verifyMessage).mockResolvedValueOnce(true)
    // use injected mockClient instead of calling createPublicClient()
    mockClient.readContract.mockResolvedValueOnce([BigInt(2), true])
    tokenModel.findUnique.mockResolvedValueOnce(null)

    const res = await makeReq({
      tokenId:    1,
      message:    'm',
      signature:  VALID_SIG,
      address:    VALID_ADDR,
      timestamp:  now,
    })
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.title).toBe('You do not own this token')
    expect(data.status).toBe(403)
  })

  it('403: token already used', async () => {
    vi.mocked(verifyMessage).mockResolvedValueOnce(true)
    mockClient.readContract.mockResolvedValueOnce([BigInt(1), true])
    tokenModel.findUnique.mockResolvedValueOnce({ used: true })

    const res = await makeReq({
      tokenId:    1,
      message:    'm',
      signature:  VALID_SIG,
      address:    VALID_ADDR,
      timestamp:  now,
    })
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.title).toBe('This token has already been used')
    expect(data.status).toBe(403)
  })

  it('500: failed to verify token ownership on chain error', async () => {
    vi.mocked(verifyMessage).mockResolvedValueOnce(true)
    mockClient.readContract.mockRejectedValueOnce(new Error('chain fail'))

    const res = await makeReq({
      tokenId:    1,
      message:    'm',
      signature:  VALID_SIG,
      address:    VALID_ADDR,
      timestamp:  now,
    })
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.title).toBe('Failed to verify token ownership')
    expect(data.status).toBe(500)
  })

  it('200: success (dev mode)', async () => {
    vi.mocked(verifyMessage).mockResolvedValueOnce(true)
    mockClient.readContract.mockResolvedValueOnce([BigInt(1), true])
    tokenModel.findUnique.mockResolvedValueOnce({ used: false })
    tokenModel.upsert.mockResolvedValueOnce({})

    const res = await makeReq({
      tokenId:    1,
      message:    'm',
      signature:  VALID_SIG,
      address:    VALID_ADDR,
      timestamp:  now,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, message: 'Access granted' })
  })

  // ─── NEW: Methods not allowed ───────────────────────────────────────────────
  it.each(['GET','PUT','DELETE','PATCH','HEAD'] as const)('405: %s not allowed', async (method) => {
    const res = await makeReqAnyMethod(method)
    expect(res.status).toBe(405)
    expect(res.headers.get('Allow')).toBe('POST, OPTIONS')
    const ct = String(res.headers.get('Content-Type') || '')
    expect(ct).toContain('application/problem+json')

    // HEAD responses may have an empty body, so only check the JSON for non-HEAD.
    if (method !== 'HEAD') {
      const data = await res.json()
      expect(data.title).toBe('Method Not Allowed')
      expect(data.status).toBe(405)
      expect(String(data.type || '')).toMatch(/\/405$/)
    }
  })
})

describe('POST /api/form-submission-gate (production mode)', () => {
  let tokenModel: { findUnique: Mock; upsert: Mock }
  let mockClient: { readContract: Mock }
  const now = Date.now()
  let savedEnv: NodeJS.ProcessEnv

  beforeAll(async () => {
    savedEnv = saveEnv()
    resetModulesAndSeed(seedServerTest, {
      NODE_ENV: 'production',
      USE_CLOUDFLARE_WORKER: 'true',
      CLOUDFLARE_WORKER_URL: 'https://worker.test',
      NEXT_PUBLIC_ACTIVE_CHAIN: 'sepolia',
    })
    const route = await import('../route')
    POSTCurrent = route.POST
  }, HOOK_TIMEOUT)

  afterAll(() => {
    restoreEnv(savedEnv)
  })

  beforeEach(() => {
    vi.mocked(checkRateLimitWithNonce).mockResolvedValue({ success: true, limit: 5, remaining: 5 })

    tokenModel = { findUnique: vi.fn(), upsert: vi.fn() }
    vi.mocked(getTokenModel).mockReturnValue(tokenModel as any)

    mockSepoliaChain()

    mockClient = { readContract: vi.fn() }
    vi.mocked(createPublicClient).mockReturnValue(mockClient as any)

    vi.mocked(verifyMessage).mockReset()
    ;(global as any).fetch = vi.fn()
    delete process.env.NEXT_PUBLIC_DOMAIN
  })

  const makeReqProd = (body: unknown, host = 'localhost:3000'): Promise<Response> => {
    const req = new NextRequest(`http://${host}/api/form-submission-gate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-host': host },
      body: JSON.stringify(body),
    } as any)
    return POSTCurrent(req as any)
  }

  it('200: success with email notification via Cloudflare Worker', async () => {
    vi.mocked(verifyMessage).mockResolvedValueOnce(true)
    mockClient.readContract.mockResolvedValueOnce([BigInt(1), true])
    tokenModel.findUnique.mockResolvedValueOnce({ used: false })
    tokenModel.upsert.mockResolvedValueOnce({})

    ;(global.fetch as Mock).mockResolvedValueOnce({
      ok:      true,
      status:  200,
      headers: { entries: () => [] },
      text:    async () => JSON.stringify({ messageId: 'msg-123' }),
    } as any)

    const res = await makeReqProd({
      tokenId:    1,
      message:    'hello',
      signature:  VALID_SIG,
      address:    VALID_ADDR,
      timestamp:  now,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, message: 'Access granted' })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://worker.test',
      expect.objectContaining({
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          tokenId:   '1',
          message:   'hello',
          address:   VALID_ADDR,
          timestamp: now,
        }),
      })
    )
  })

  it('500: production when email service fails', async () => {
    vi.mocked(verifyMessage).mockResolvedValueOnce(true)
    mockClient.readContract.mockResolvedValueOnce([BigInt(1), true])
    tokenModel.findUnique.mockResolvedValueOnce({ used: false })

    ;(global.fetch as Mock).mockResolvedValueOnce({
      ok:      false,
      status:  500,
      headers: { entries: () => [] },
      text:    async () => JSON.stringify({ error: 'service error' }),
    } as any)

    const res = await makeReqProd({
      tokenId:    1,
      message:    'world',
      signature:  VALID_SIG,
      address:    VALID_ADDR,
      timestamp:  now,
    })
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.title).toBe('Failed to process submission')
    expect(data.status).toBe(500)
    expect(data.detail).toBe('service error')
  })
})

describe('POST /api/form-submission-gate (production mode - Brevo direct)', () => {
  let tokenModel: { findUnique: Mock; upsert: Mock }
  let mockClient: { readContract: Mock }
  const now = Date.now()
  let savedEnv: NodeJS.ProcessEnv

  beforeAll(async () => {
    savedEnv = saveEnv()
    resetModulesAndSeed(seedServerTest, {
      NODE_ENV: 'production',
      USE_CLOUDFLARE_WORKER: 'false',
      BREVO_API_KEY: 'test-api-key',
      SENDER_EMAIL: 'sender@test.com',
      RECEIVER_EMAIL: 'receiver@test.com',
      NEXT_PUBLIC_ACTIVE_CHAIN: 'sepolia',
    })
    const route = await import('../route')
    POSTCurrent = route.POST
  }, HOOK_TIMEOUT)

  afterAll(() => {
    restoreEnv(savedEnv)
  })

  beforeEach(() => {
    vi.mocked(checkRateLimitWithNonce).mockResolvedValue({ success: true, limit: 5, remaining: 5 })

    tokenModel = { findUnique: vi.fn(), upsert: vi.fn() }
    vi.mocked(getTokenModel).mockReturnValue(tokenModel as any)

    mockSepoliaChain()

    mockClient = { readContract: vi.fn() }
    vi.mocked(createPublicClient).mockReturnValue(mockClient as any)

    vi.mocked(verifyMessage).mockReset()
    ;(global as any).fetch = vi.fn()
    delete process.env.NEXT_PUBLIC_DOMAIN
  })

  const makeReqProdBrevo = (body: unknown, host = 'localhost:3000'): Promise<Response> => {
    const req = new NextRequest(`http://${host}/api/form-submission-gate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-host': host },
      body: JSON.stringify(body),
    } as any)
    return POSTCurrent(req as any)
  }

  it('200: success with email notification via Brevo API', async () => {
    vi.mocked(verifyMessage).mockResolvedValueOnce(true)
    mockClient.readContract.mockResolvedValueOnce([BigInt(1), true])
    tokenModel.findUnique.mockResolvedValueOnce({ used: false })
    tokenModel.upsert.mockResolvedValueOnce({})

    ;(global.fetch as Mock).mockResolvedValueOnce({
      ok:      true,
      status:  201,
      headers: { entries: () => [] },
      text:    async () => JSON.stringify({ messageId: 'brevo-msg-123' }),
    } as any)

    const res = await makeReqProdBrevo({
      tokenId:    1,
      message:    'hello brevo',
      signature:  VALID_SIG,
      address:    VALID_ADDR,
      timestamp:  now,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, message: 'Access granted' })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/smtp/email',
      expect.objectContaining({
        method:  'POST',
        headers: {
          accept: 'application/json',
          'api-key': 'test-api-key',
          'content-type': 'application/json',
        },
        body: expect.stringContaining(`"to":[{"email":"receiver@test.com"`),
      })
    )
  })

  it('500: production when Brevo API fails', async () => {
    vi.mocked(verifyMessage).mockResolvedValueOnce(true)
    mockClient.readContract.mockResolvedValueOnce([BigInt(1), true])
    tokenModel.findUnique.mockResolvedValueOnce({ used: false })

    ;(global.fetch as Mock).mockResolvedValueOnce({
      ok:      false,
      status:  400,
      headers: { entries: () => [] },
      text:    async () => JSON.stringify({ message: 'Invalid API key' }),
    } as any)

    const res = await makeReqProdBrevo({
      tokenId:    1,
      message:    'world',
      signature:  VALID_SIG,
      address:    VALID_ADDR,
      timestamp:  now,
    })
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.title).toBe('Failed to process submission')
    expect(data.status).toBe(500)
    expect(data.detail).toBe('Invalid API key')
  })

  it('500: missing Brevo config when USE_CLOUDFLARE_WORKER is false', async () => {
    delete process.env.BREVO_API_KEY

    vi.resetModules()
    const route = await import('../route')
    const POSTWithoutBrevo = route.POST

    vi.mocked(verifyMessage).mockResolvedValueOnce(true)
    mockClient.readContract.mockResolvedValueOnce([BigInt(1), true])
    tokenModel.findUnique.mockResolvedValueOnce({ used: false })

    const req = new NextRequest('http://localhost:3000/api/form-submission-gate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-host': 'localhost:3000' },
      body: JSON.stringify({
        tokenId:    1,
        message:    'test',
        signature:  VALID_SIG,
        address:    VALID_ADDR,
        timestamp:  now,
      }),
    } as any)

    const res = await POSTWithoutBrevo(req as any)

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.title).toBe('Failed to process submission')
    expect(data.status).toBe(500)
    expect(data.detail).toBe('Email service not configured')

    process.env.BREVO_API_KEY = 'test-api-key'
  })
})
