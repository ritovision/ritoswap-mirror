/// <reference types="vitest/globals" />
import { NextRequest, NextResponse } from 'next/server'
import type { Mock } from 'vitest'

// --- module mocks must come before any imports of GET ---
vi.mock('viem', () => ({
  createPublicClient: vi.fn(),
  http: vi.fn(() => ({})),
  defineChain: vi.fn((config) => config),
}))

vi.mock('viem/chains', () => ({
  mainnet: { id: 1 },
  sepolia: { id: 11155111 },
}))

vi.mock('@/app/lib/prisma/prismaNetworkUtils', () => ({
  getTokenModel: vi.fn(),
  getChainConfig: vi.fn(),
  prisma: {},
}))

vi.mock('@/app/lib/rateLimit/rateLimit.server', () => ({
  checkRateLimitWithNonce: vi.fn(),
}))

vi.mock('@/app/config/contracts', () => ({
  fullKeyTokenAbi: [],
  KEY_TOKEN_ADDRESS: '0xContract',
}))

vi.mock('@/app/config/chain', () => ({
  CHAIN_IDS: {
    ethereum: 1,
    sepolia: 11155111,
  },
  getActiveChain: vi.fn(() => 'ethereum'),
}))

vi.mock('@/app/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

vi.mock('@/app/lib/http/cors', () => ({
  withCors: vi.fn((response) => response),
  handleCors: vi.fn(() => null),
}))

vi.mock('@/app/lib/http/response', () => ({
  problemResponse: vi.fn((status, title, detail) => {
    return NextResponse.json(
      {
        type: 'about:blank',
        title,
        status,
        detail: typeof detail === 'string' ? detail : undefined,
      },
      { status }
    )
  }),
  rateLimitResponse: vi.fn((rateLimitResult, message) => {
    const retryAfter = rateLimitResult.reset 
      ? Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
      : 60
    
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Too many requests',
        status: 429,
        detail: message,
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'Retry-After': String(retryAfter),
        },
      }
    )
  }),
  validateResponse: vi.fn((schema, data) => data),
}))

vi.mock('@/app/schemas/dto/token-status.dto', () => ({
  parseTokenIdParam: vi.fn((params) => {
    const tokenId = parseInt(params.tokenId, 10)
    if (isNaN(tokenId) || tokenId < 0 || params.tokenId === '') {
      return {
        success: false,
        error: { message: 'Invalid token ID' },
      }
    }
    return { success: true, tokenId }
  }),
  createTokenStatusResponse: vi.fn((exists, used, usedBy, usedAt) => ({
    count: exists ? 1 : 0,
    exists,
    used,
    usedBy,
    usedAt,
  })),
  TokenStatusResponseSchema: {},
}))

import { GET } from '../route'
import { createPublicClient } from 'viem'
import { getTokenModel, getChainConfig } from '@/app/lib/prisma/prismaNetworkUtils'
import { checkRateLimitWithNonce } from '@/app/lib/rateLimit/rateLimit.server'

describe('GET /api/token-status/[tokenId]', () => {
  let tokenModel: {
    findUnique: Mock
    findMany: Mock
    upsert: Mock
  }
  let mockClient: { readContract: Mock }
  const now = Date.now()

  beforeAll(() => {
    mockClient = { readContract: vi.fn() }
    vi.mocked(createPublicClient).mockReturnValue(mockClient as any)
  })

  beforeEach(() => {
    // default: pass rate-limit (reset omitted → undefined)
    vi.mocked(checkRateLimitWithNonce).mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 60,
    })

    tokenModel = {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    }
    vi.mocked(getTokenModel).mockReturnValue(tokenModel as any)

    // NEW chain config shape (keep legacy fields too, for compatibility)
    vi.mocked(getChainConfig).mockReturnValue({
      chainId: 1,
      name: 'TestChain',
      rpcUrl: 'https://rpc.example.com',
      wssUrl: undefined,
      explorerUrl: undefined,
      explorerName: 'TestScan',
      isTestnet: false,
      chain: {
        id: 1,
        name: 'TestChain',
        network: 'testchain',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: {
          default: { http: ['https://rpc.example.com'] },
          public: { http: ['https://rpc.example.com'] },
        },
      },
      transport: 'https://rpc.example.com',
    } as any)

    mockClient.readContract.mockReset()
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  function makeRequest(tokenId: string) {
    const url = `http://localhost:3000/api/token-status/${encodeURIComponent(tokenId)}`
    const req = new NextRequest(url, { method: 'GET' })
    return GET(req, { params: { tokenId } })
  }

  it('400: invalid token IDs', async () => {
    for (const badId of ['foo', '-1', '']) {
      const res = await makeRequest(badId)
      const body = await res.json()
      expect(res.status).toBe(400)
      // problem+json: summary in `title`
      expect(body.title).toBe('Invalid token ID')
    }
  })

  it('429: too many requests when rate limit exceeded', async () => {
    const resetTs = now + 90 * 1000
    vi.mocked(checkRateLimitWithNonce).mockResolvedValueOnce({
      success: false,
      limit: 5,
      remaining: 0,
      reset: resetTs,
    })

    const res = await makeRequest('1')
    const retryAfter = Math.ceil((resetTs - now) / 1000)

    expect(res.status).toBe(429)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(Number(res.headers.get('Retry-After'))).toBe(retryAfter)

    const body = await res.json()
    expect(body.title).toBe('Too many requests')
    expect(body.limit).toBe(5)
    expect(body.remaining).toBe(0)
    expect(body.retryAfter).toBe(retryAfter)
  })

  it('429: too many requests fallback when no reset provided', async () => {
    // simulate rate-limited without reset field
    vi.mocked(checkRateLimitWithNonce).mockResolvedValueOnce({
      success: false,
      limit: 7,
      remaining: 1,
      // reset: undefined
    })

    const res = await makeRequest('2')
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('7')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('1')
    expect(res.headers.get('Retry-After')).toBe('60')

    expect(body.title).toBe('Too many requests')
    expect(body.limit).toBe(7)
    expect(body.remaining).toBe(1)
    expect(body.retryAfter).toBe(60)
  })

  it('returns the DB record when present and skips on-chain (unused case)', async () => {
    const example = {
      tokenId: 7,
      used: false,
      usedBy: 'Bob',
      usedAt: '2025-07-01T08:00:00Z',
    }
    tokenModel.findUnique.mockResolvedValueOnce(example)

    const res = await makeRequest('7')
    expect(res.status).toBe(200)

    expect(tokenModel.findUnique).toHaveBeenCalledWith({ where: { tokenId: 7 } })
    expect(mockClient.readContract).not.toHaveBeenCalled()
    expect(tokenModel.findMany).not.toHaveBeenCalled()
    expect(tokenModel.upsert).not.toHaveBeenCalled()

    const body = await res.json()
    expect(body).toEqual({
      count: 1,
      exists: true,
      used: false,
      usedBy: 'Bob',
      usedAt: '2025-07-01T08:00:00Z',
    })
  })

  it('returns the DB record when present and skips on-chain (used case)', async () => {
    const example = {
      tokenId: 8,
      used: true,
      usedBy: 'Alice',
      usedAt: '2025-07-02T10:00:00Z',
    }
    tokenModel.findUnique.mockResolvedValueOnce(example)

    const res = await makeRequest('8')
    expect(res.status).toBe(200)

    expect(tokenModel.findUnique).toHaveBeenCalledWith({ where: { tokenId: 8 } })

    const body = await res.json()
    expect(body).toEqual({
      count: 1,
      exists: true,
      used: true,
      usedBy: 'Alice',
      usedAt: '2025-07-02T10:00:00Z',
    })
  })

  it('checks on-chain, upserts unused, and returns it when not in DB', async () => {
    tokenModel.findUnique.mockResolvedValueOnce(null)
    // older code used to scan neighbors; current implementation may skip this call
    tokenModel.findMany.mockResolvedValueOnce([{ tokenId: 3 }])
    mockClient.readContract.mockResolvedValueOnce('uri://3')
    tokenModel.upsert.mockResolvedValueOnce({
      tokenId: 3,
      used: false,
      usedBy: null,
      usedAt: null,
    })

    const res = await makeRequest('3')
    expect(res.status).toBe(200)

    expect(tokenModel.findUnique).toHaveBeenCalledWith({ where: { tokenId: 3 } })
    // no assert on findMany (implementation no longer requires it)
    expect(mockClient.readContract).toHaveBeenCalledWith({
      address: '0xContract',
      abi: [],
      functionName: 'tokenURI',
      args: [BigInt(3)],
    })
    expect(tokenModel.upsert).toHaveBeenCalledWith({
      where: { tokenId: 3 },
      update: {},
      create: { tokenId: 3, used: false },
    })

    const body = await res.json()
    expect(body).toEqual({
      count: 1,
      exists: true,
      used: false,
      usedBy: null,
      usedAt: null,
    })
  })

  it('returns "not found" when neither DB nor on-chain has the token', async () => {
    tokenModel.findUnique.mockResolvedValueOnce(null)
    tokenModel.findMany.mockResolvedValueOnce([])
    mockClient.readContract.mockRejectedValueOnce(new Error('missing'))

    const res = await makeRequest('10')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toEqual({
      count: 0,
      exists: false,
      used: false,
      usedBy: null,
      usedAt: null,
    })
  })

  it('500: unexpected error bubbles up', async () => {
    vi.mocked(getTokenModel).mockImplementationOnce(() => {
      throw new Error('DB down')
    })

    const res = await makeRequest('4')
    const body = await res.json()
    expect(res.status).toBe(500)
    // problem+json: summary in `title`
    expect(body.title).toBe('Failed to check token status')
  })
})