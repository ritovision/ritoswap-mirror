// app/api/gate-access/__tests__/gate-access.test.ts

/// <reference types="vitest/globals" />
/* ──────────────────────────────
   0) CONSTANTS / HELPERS
   ────────────────────────────── */
const VALID_ADDR  = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const VALID_SIG   = '0x' + 'a'.repeat(130) // 65-byte hex ECDSA (passes SignatureSchema)
const VALID_NONCE = '0123456789abcdef0123456789abcdef' // 32 hex chars (16 bytes)
const BAD_NONCE   = 'ffffffffffffffffffffffffffffffff' // also 32 hex, will fail at verifyNonce
const VALID_JWT   = 'header.payload.sig' // dummy; we mock verifyAccessToken

/** Build a minimally-valid SIWE message */
function buildSiweMessage(params: {
  domain: string
  address: string
  nonce: string
  statement?: string
  uri?: string
  chainId?: number
  issuedAt?: string
}) {
  const {
    domain,
    address,
    nonce,
    statement = 'Sign in to access token gate with key #42',
    uri = `http://${domain}`,
    chainId = 1,
    issuedAt = new Date().toISOString(),
  } = params

  return `${domain} wants you to sign in with your Ethereum account:
${address}

${statement}

URI: ${uri}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}`
}

// Common headers for legacy requests (binds domain via x-forwarded-host)
const LEGACY_HEADERS = {
  'Content-Type': 'application/json',
  'x-forwarded-host': 'localhost:3000',
}

/* ──────────────────────────────
   1) HOISTED MOCKS (must be before importing the route)
   ────────────────────────────── */

// Next.js "server-only" virtual module trips Vitest unless we stub it
vi.mock('server-only', () => ({}))

// Mock jwt.server config so we don't import real env validators
vi.mock('@/app/config/jwt.server', () => ({
  jwtServerConfig: {
    alg: 'HS256',
    secret: new TextEncoder().encode('test-secret'),
    issuer: 'http://localhost:3000',
    audiences: ['localhost:3000'],
    accessTtlSec: 900,
    clockToleranceSec: 0,
  },
}))

vi.mock('viem', () => ({
  verifyMessage: vi.fn(),
  recoverMessageAddress: vi.fn(async () => VALID_ADDR),
  createPublicClient: vi.fn(),
  defineChain: vi.fn((x: any) => x),
  http: vi.fn(() => ({})), // dummy transport
}))

vi.mock('viem/chains', () => ({
  mainnet: { id: 1, name: 'mainnet' },
  sepolia: { id: 11155111, name: 'sepolia' },
}))

// Public env: deterministic for allowlist + siwe flag reads
vi.mock('@/app/config/public.env', () => ({
  publicEnv: {
    NEXT_PUBLIC_DOMAIN: 'localhost:3000',
    NEXT_PUBLIC_ENABLE_STATE_WORKER: false,
  },
}))

// Chain config used by legacy auth helper (nonSiweAuth.ts)
vi.mock('@/app/config/chain', () => ({
  CHAIN_IDS: { ethereum: 1, sepolia: 11155111 },
  getChainConfig: vi.fn(() => ({
    chainId: 11155111,
    name: 'sepolia',
    rpcUrl: 'http://localhost:8545',
    isTestnet: true,
  })),
}))

vi.mock('@/app/lib/siwe/siwe.server', () => ({
  isSiweEnabled: vi.fn(),
  verifyNonce: vi.fn(),
  verifySiweMessage: vi.fn(),
  getDomain: vi.fn(),
}))

vi.mock('@/app/lib/rateLimit/rateLimit.server', () => ({
  checkRateLimitWithNonce: vi.fn(),
  getIdentifier: vi.fn(),
}))

vi.mock('@/app/lib/prisma/prismaNetworkUtils', () => ({
  getTokenModel: vi.fn(),
  getChainConfig: vi.fn(),
}))

vi.mock('@lib/server/gatedContent', () => ({
  getGatedContent: vi.fn(),
}))

vi.mock('@/app/config/contracts', () => ({
  fullKeyTokenAbi: [],
  KEY_TOKEN_ADDRESS: '0xContract',
}))

// Mock legacy auth helpers (route calls these)
const mockAssertLegacyAuth = vi.fn()
vi.mock('@/app/lib/auth/nonSiweAuth', () => ({
  assertLegacyAuth: (...args: any[]) => mockAssertLegacyAuth(...args),
  normalizeHost: (s: string | null) => (s ? s.toLowerCase() : s),
  getRequestHost: (req: Request) =>
    new Headers((req as any).headers).get('x-forwarded-host') ||
    new Headers((req as any).headers).get('host'),
  getAllowedDomains: () => ['localhost:3000'],
  buildLegacyExpectedMessage: (params: any) => [
    `I own key #${params.tokenId}`,
    `Domain: ${params.reqHost}`,
    `Path: ${params.path}`,
    `Method: ${params.method}`,
    `ChainId: ${params.chainId}`,
    `Timestamp: ${params.timestamp}`,
  ].join('\n'),
}))

// JWT server helpers: route imports and uses these
const mockVerifyAccessToken = vi.fn()
const mockSignAccessToken = vi.fn()
vi.mock('@/app/lib/jwt/server', () => ({
  readBearerFromRequest: (req: Request | { headers: Headers }) => {
    const h = 'headers' in req ? req.headers : new Headers()
    const v = h.get('authorization') || h.get('Authorization')
    if (!v || !v.startsWith('Bearer ')) return null
    return v.slice(7)
  },
  verifyAccessToken: (...args: any[]) => mockVerifyAccessToken(...args),
  signAccessToken: (...args: any[]) => mockSignAccessToken(...args),
}))

/* ──────────────────────────────
   2) IMPORTS (after mocks)
   ────────────────────────────── */
import { NextRequest } from 'next/server'
import { POST } from '../route'
import * as siweServer from '@/app/lib/siwe/siwe.server'
import * as rateLimitServer from '@/app/lib/rateLimit/rateLimit.server'
import * as prismaUtils from '@/app/lib/prisma/prismaNetworkUtils'
import { verifyMessage, createPublicClient } from 'viem'
import { getGatedContent } from '@lib/server/gatedContent'

describe('POST /api/gate-access', () => {
  const mockPublicClient = { readContract: vi.fn() }
  const mockTokenModel   = { findUnique: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_DOMAIN = 'localhost:3000'

    // Wire up viem & Prisma mocks
    vi.mocked(createPublicClient).mockReturnValue(mockPublicClient as any)
    vi.mocked(prismaUtils.getTokenModel).mockReturnValue(mockTokenModel as any)

    // Sepolia for the route's on-chain check (this one is read by route.ts)
    vi.mocked(prismaUtils.getChainConfig).mockReturnValue({
      chainId: 11155111,
      name: 'sepolia',
      rpcUrl: 'http://localhost:8545',
      isTestnet: true,
    } as any)

    // Default happy-path content
    vi.mocked(getGatedContent).mockResolvedValue({
      welcomeText: 'Welcome to the gate!',
      textSubmissionAreaHtml: '<div>Submit form</div>',
      audioData: {
        headline: 'Exclusive Audio',
        imageSrc: '/audio-cover.jpg',
        imageAlt: 'Audio cover',
        description: 'Exclusive content for token holders',
        title: 'Token Holder Music',
        audioSrc: '/audio/exclusive.mp3',
        error: false,
      },
      styles: '.test { color: red; }',
      script: 'console.log("loaded");',
    })

    // Rate limit default OK
    vi.mocked(rateLimitServer.checkRateLimitWithNonce).mockResolvedValue({ success: true })
  })

  describe('Input validation', () => {
    it('returns 400 for invalid JSON', async () => {
      const req = new NextRequest('http://localhost:3000/api/gate-access', {
        method: 'POST',
        body: 'not a json',
      } as any)
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.title).toBe('Invalid request')
      expect(data.detail).toBe('Request body validation failed')
    })

    it('returns 400 for missing address', async () => {
      const req = new NextRequest('http://localhost:3000/api/gate-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: VALID_SIG, tokenId: 1 }),
      } as any)
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.title).toBe('Invalid request')
    })

    it('returns 400 for missing signature', async () => {
      const req = new NextRequest('http://localhost:3000/api/gate-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: VALID_ADDR, tokenId: 1 }),
      } as any)
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.title).toBe('Invalid request')
    })

    it('returns 400 for missing tokenId', async () => {
      const req = new NextRequest('http://localhost:3000/api/gate-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: VALID_ADDR, signature: VALID_SIG }),
      } as any)
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.title).toBe('Invalid request')
    })

    it('returns 400 for invalid field types', async () => {
      const req = new NextRequest('http://localhost:3000/api/gate-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // address intentionally wrong type → parse should fail
        body: JSON.stringify({ address: 123, signature: VALID_SIG, tokenId: '42' }),
      } as any)
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.title).toBe('Invalid request')
      expect(data.detail).toBe('Request body validation failed')
    })

    it('returns 400 for missing timestamp in legacy flow', async () => {
      vi.mocked(siweServer.isSiweEnabled).mockReturnValue(false)
      const req = new NextRequest('http://localhost:3000/api/gate-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: VALID_ADDR,
          signature: VALID_SIG,
          tokenId: 1,
          // timestamp omitted
        }),
      } as any)
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.title).toBe('Invalid request')
    })
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(rateLimitServer.checkRateLimitWithNonce).mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Date.now() + 60000,
    })

    const req = new NextRequest('http://localhost:3000/api/gate-access', {
      method: 'POST',
      headers: LEGACY_HEADERS as any,
      body: JSON.stringify({ address: VALID_ADDR, signature: VALID_SIG, tokenId: 1 }),
    } as any)
    const res = await POST(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(res.headers.get('Retry-After')).toBeDefined()
  })

  describe('JWT path', () => {
    beforeEach(() => {
      // On-chain and DB OK by default
      mockPublicClient.readContract.mockResolvedValue([BigInt(42), true])
      mockTokenModel.findUnique.mockResolvedValue({ tokenId: 42, used: false })
    })

    it('accepts valid JWT and returns content (no new token minted)', async () => {
      // verifyAccessToken resolves with typed payload
      mockVerifyAccessToken.mockResolvedValue({
        payload: {
          kind: 'access',
          auth: 'siwe',
          iss: 'http://localhost:3000',
          aud: ['localhost:3000'],
          sub: VALID_ADDR.toLowerCase(),
          iat: Math.floor(Date.now() / 1000) - 10,
          exp: Math.floor(Date.now() / 1000) + 600,
          jti: '00000000-0000-4000-8000-000000000001',
          scopes: ['gate:read'],
          tokenId: '42',
          siwe: {
            address: VALID_ADDR.toLowerCase(),
            domain: 'localhost:3000',
            chainId: 1,
            nonce: VALID_NONCE,
            issuedAt: new Date().toISOString(),
          },
          siwe_hash: '0x' + 'b'.repeat(64),
        },
        header: { alg: 'HS256' },
      })

      const req = new NextRequest('http://localhost:3000/api/gate-access', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${VALID_JWT}`,
          'Content-Type': 'application/json',
          'x-forwarded-host': 'localhost:3000',
        } as any,
        body: JSON.stringify({ tokenId: 42 }),
      } as any)
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.access).toBe('granted')
      // We don't assert rotation here
    })

    it('rejects when body tokenId mismatches JWT tokenId', async () => {
      mockVerifyAccessToken.mockResolvedValue({
        payload: {
          kind: 'access',
          auth: 'siwe',
          iss: 'http://localhost:3000',
          aud: ['localhost:3000'],
          sub: VALID_ADDR.toLowerCase(),
          iat: Math.floor(Date.now() / 1000) - 10,
          exp: Math.floor(Date.now() / 1000) + 600,
          jti: '00000000-0000-4000-8000-000000000001',
          scopes: ['gate:read'],
          tokenId: '999', // <- mismatch
          siwe: {
            address: VALID_ADDR.toLowerCase(),
            domain: 'localhost:3000',
            chainId: 1,
            nonce: VALID_NONCE,
            issuedAt: new Date().toISOString(),
          },
          siwe_hash: '0x' + 'b'.repeat(64),
        },
        header: { alg: 'HS256' },
      })

      const req = new NextRequest('http://localhost:3000/api/gate-access', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${VALID_JWT}`,
          'Content-Type': 'application/json',
          'x-forwarded-host': 'localhost:3000',
        } as any,
        body: JSON.stringify({ tokenId: 42 }),
      } as any)
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.title).toBe('Authentication failed')
    })

    it('falls back to body auth when JWT verify fails', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('bad token'))

      // switch to legacy for body flow
      vi.mocked(siweServer.isSiweEnabled).mockReturnValue(false)

      // Legacy success via mocked assertLegacyAuth
      mockAssertLegacyAuth.mockResolvedValue({
        success: true,
        reqHost: 'localhost:3000',
        chainId: 11155111,
        expectedMessage: [
          'I own key #42',
          'Domain: localhost:3000',
          'Path: /api/gate-access',
          'Method: POST',
          'ChainId: 11155111',
          `Timestamp: 123`,
        ].join('\n'),
      })

      // On-chain/DB OK
      mockPublicClient.readContract.mockResolvedValue([BigInt(42), true])
      mockTokenModel.findUnique.mockResolvedValue({ tokenId: 42, used: false })
      mockSignAccessToken.mockResolvedValue('new.jwt.from.legacy')

      const req = new NextRequest('http://localhost:3000/api/gate-access', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${VALID_JWT}`, // won't matter
          'Content-Type': 'application/json',
          'x-forwarded-host': 'localhost:3000',
        } as any,
        body: JSON.stringify({ address: VALID_ADDR, signature: VALID_SIG, tokenId: 42, timestamp: 123 }),
      } as any)
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      // not asserting token rotation; route may not return/mint
    })
  })

  describe('SIWE flow', () => {
    it('verifies SIWE message successfully (body auth path)', async () => {
      vi.mocked(siweServer.isSiweEnabled).mockReturnValue(true)
      vi.mocked(rateLimitServer.getIdentifier).mockReturnValue('id-123')
      vi.mocked(siweServer.verifyNonce).mockResolvedValue({ isValid: true })
      vi.mocked(verifyMessage).mockResolvedValue(true)
      mockSignAccessToken.mockResolvedValue('new.jwt.from.siwe')

      const domain  = 'localhost:3000'
      const address = VALID_ADDR
      const nonce   = VALID_NONCE
      const expectedChainId = 11155111 // Must match mock getChainConfig
      const message = buildSiweMessage({ domain, address, nonce, chainId: expectedChainId })

      vi.mocked(siweServer.verifySiweMessage).mockResolvedValue({
        success: true,
        parsed: {
          domain,
          address,
          statement: 'Sign in to access token gate with key #42',
          uri: `http://${domain}`,
          version: '1',
          chainId: expectedChainId,
          nonce,
          issuedAt: new Date().toISOString(),
        },
      })

      // On-chain + DB happy path
      mockPublicClient.readContract.mockResolvedValue([BigInt(42), true])
      mockTokenModel.findUnique.mockResolvedValue({ tokenId: 42, used: false })

      const req = new NextRequest(`http://${domain}/api/gate-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-host': domain,
        } as any,
        body: JSON.stringify({
          address,
          signature: VALID_SIG,
          tokenId: 42,
          message,
          nonce,
        }),
      } as any)
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.access).toBe('granted')
      // don't assert signAccessToken calls
    })

    it('fails with invalid nonce', async () => {
      vi.mocked(siweServer.isSiweEnabled).mockReturnValue(true)
      vi.mocked(siweServer.verifyNonce).mockResolvedValue({ isValid: false, reason: 'mismatch' })

      const domain  = 'localhost:3000'
      const address = VALID_ADDR
      const nonce   = BAD_NONCE // schema-valid, but will fail verifier
      const message = buildSiweMessage({ domain, address, nonce })

      const req = new NextRequest(`http://${domain}/api/gate-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-host': domain,
        } as any,
        body: JSON.stringify({
          address,
          signature: VALID_SIG,
          tokenId: 1,
          message,
          nonce,
        }),
      } as any)
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.title).toBe('Authentication failed')
    })

    it('fails with wrong chain ID', async () => {
      vi.mocked(siweServer.isSiweEnabled).mockReturnValue(true)
      vi.mocked(rateLimitServer.getIdentifier).mockReturnValue('id-123')
      vi.mocked(siweServer.verifyNonce).mockResolvedValue({ isValid: true })
      vi.mocked(verifyMessage).mockResolvedValue(true)

      const domain  = 'localhost:3000'
      const address = VALID_ADDR
      const nonce   = VALID_NONCE
      const wrongChainId = 1 // Mainnet, but server expects 11155111 (Sepolia)
      const message = buildSiweMessage({ domain, address, nonce, chainId: wrongChainId })

      vi.mocked(siweServer.verifySiweMessage).mockResolvedValue({
        success: true,
        parsed: {
          domain,
          address,
          statement: 'Sign in to access token gate with key #42',
          uri: `http://${domain}`,
          version: '1',
          chainId: wrongChainId,
          nonce,
          issuedAt: new Date().toISOString(),
        },
      })

      const req = new NextRequest(`http://${domain}/api/gate-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-host': domain,
        } as any,
        body: JSON.stringify({
          address,
          signature: VALID_SIG,
          tokenId: 42,
          message,
          nonce,
        }),
      } as any)
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.title).toBe('Authentication failed')
    })
  })

  describe('Legacy flow', () => {
    it('verifies legacy signature successfully (via helper)', async () => {
      vi.mocked(siweServer.isSiweEnabled).mockReturnValue(false)

      const timestamp = Date.now()
      // assertLegacyAuth returns success & expectedMessage
      mockAssertLegacyAuth.mockResolvedValue({
        success: true,
        reqHost: 'localhost:3000',
        chainId: 11155111,
        expectedMessage: [
          'I own key #42',
          'Domain: localhost:3000',
          'Path: /api/gate-access',
          'Method: POST',
          'ChainId: 11155111',
          `Timestamp: ${timestamp}`,
        ].join('\n'),
      })

      mockPublicClient.readContract.mockResolvedValue([BigInt(42), true])
      mockTokenModel.findUnique.mockResolvedValue({ tokenId: 42, used: false })

      const req = new NextRequest('http://localhost:3000/api/gate-access', {
        method: 'POST',
        headers: LEGACY_HEADERS as any,
        body: JSON.stringify({
          address: VALID_ADDR,
          signature: VALID_SIG,
          tokenId: 42,
          timestamp,
        }),
      } as any)
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.access).toBe('granted')
    })

    it('fails with expired timestamp', async () => {
      vi.mocked(siweServer.isSiweEnabled).mockReturnValue(false)

      mockAssertLegacyAuth.mockResolvedValue({
        success: false,
        status: 401,
        code: 'EXPIRED',
        message: 'expired',
      })

      const old = Date.now() - 6 * 60 * 1000
      const req = new NextRequest('http://localhost:3000/api/gate-access', {
        method: 'POST',
        headers: LEGACY_HEADERS as any,
        body: JSON.stringify({
          address: VALID_ADDR,
          signature: VALID_SIG,
          tokenId: 1,
          timestamp: old,
        }),
      } as any)
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.title).toBe('Authentication failed')
    })
  })

  describe('Token verification', () => {
    beforeEach(() => {
      vi.mocked(siweServer.isSiweEnabled).mockReturnValue(false)
      // legacy helper OK by default for these tests
      mockAssertLegacyAuth.mockResolvedValue({
        success: true,
        reqHost: 'localhost:3000',
        chainId: 11155111,
        expectedMessage: 'x',
      })
    })

    it('fails when user does not own token', async () => {
      mockPublicClient.readContract.mockResolvedValue([BigInt(999), false])

      const req = new NextRequest('http://localhost:3000/api/gate-access', {
        method: 'POST',
        headers: LEGACY_HEADERS as any,
        body: JSON.stringify({
          address: VALID_ADDR,
          signature: VALID_SIG,
          tokenId: 42,
          timestamp: Date.now(),
        }),
      } as any)
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.title).toBe('You do not own this token')
    })

    it('fails when token not found in database', async () => {
      mockPublicClient.readContract.mockResolvedValue([BigInt(42), true])
      mockTokenModel.findUnique.mockResolvedValue(null)

      const req = new NextRequest('http://localhost:3000/api/gate-access', {
        method: 'POST',
        headers: LEGACY_HEADERS as any,
        body: JSON.stringify({
          address: VALID_ADDR,
          signature: VALID_SIG,
          tokenId: 42,
          timestamp: Date.now(),
        }),
      } as any)
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(404)
      expect(data.title).toBe('Token not found in database')
    })

    it('fails when token already used', async () => {
      mockPublicClient.readContract.mockResolvedValue([BigInt(42), true])
      mockTokenModel.findUnique.mockResolvedValue({ tokenId: 42, used: true })

      const req = new NextRequest('http://localhost:3000/api/gate-access', {
        method: 'POST',
        headers: LEGACY_HEADERS as any,
        body: JSON.stringify({
          address: VALID_ADDR,
          signature: VALID_SIG,
          tokenId: 42,
          timestamp: Date.now(),
        }),
      } as any)
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.title).toBe('This token has already been used')
    })
  })

  describe('Content generation', () => {
    beforeEach(() => {
      vi.mocked(siweServer.isSiweEnabled).mockReturnValue(false)
      mockAssertLegacyAuth.mockResolvedValue({
        success: true,
        reqHost: 'localhost:3000',
        chainId: 11155111,
        expectedMessage: 'x',
      })
      mockPublicClient.readContract.mockResolvedValue([BigInt(42), true])
      mockTokenModel.findUnique.mockResolvedValue({ tokenId: 42, used: false })
    })

    it('handles partial content failure gracefully', async () => {
      vi.mocked(getGatedContent).mockRejectedValue(new Error('Audio failed'))

      const req = new NextRequest('http://localhost:3000/api/gate-access', {
        method: 'POST',
        headers: LEGACY_HEADERS as any,
        body: JSON.stringify({
          address: VALID_ADDR,
          signature: VALID_SIG,
          tokenId: 42,
          timestamp: Date.now(),
        }),
      } as any)
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.access).toBe('granted')
      expect(data.content.audioError).toBe(true)
      expect(data.content.errorMessage).toBe('Audio temporarily unavailable')
      expect(data.content.welcomeText).toBeDefined()
    })

    it('gracefully falls back when content generation fails', async () => {
      vi.mocked(getGatedContent).mockRejectedValue(new Error('total failure'))

      const req = new NextRequest('http://localhost:3000/api/gate-access', {
        method: 'POST',
        headers: LEGACY_HEADERS as any,
        body: JSON.stringify({
          address: VALID_ADDR,
          signature: VALID_SIG,
          tokenId: 42,
          timestamp: Date.now(),
        }),
      } as any)
      const res  = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.access).toBe('granted')
      expect(data.content.audioError).toBe(true)
      expect(data.content.errorMessage).toBe('Audio temporarily unavailable')
      expect(data.content.welcomeText).toBeDefined()
      expect(data.content.textSubmissionAreaHtml).toBeDefined()
    })
  })

  describe('Unexpected errors', () => {
    it('throws when database operation fails unexpectedly', async () => {
      // Ensure we reach DB path inside the route:
      // - SIWE disabled, legacy auth succeeds
      // - On-chain ownership check succeeds
      // - DB read rejects (async), which throws uncaught
      vi.mocked(siweServer.isSiweEnabled).mockReturnValue(false)

      mockAssertLegacyAuth.mockResolvedValue({
        success: true,
        reqHost: 'localhost:3000',
        chainId: 11155111,
        expectedMessage: 'x',
      })

      mockPublicClient.readContract.mockResolvedValue([BigInt(42), true])

      // <-- Async rejection inside the awaited DB call
      mockTokenModel.findUnique.mockRejectedValueOnce(new Error('unexpected'))

      const req = new NextRequest('http://localhost:3000/api/gate-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-host': 'localhost:3000' } as any,
        body: JSON.stringify({
          address: VALID_ADDR,
          signature: VALID_SIG,
          tokenId: 42,
          timestamp: Date.now(),
        }),
      } as any)
      
      // The route doesn't have a try-catch around the database call,
      // so it will throw. We expect this to reject.
      await expect(POST(req)).rejects.toThrow('unexpected')
    })
  })
})