// app/api/nonce/__tests__/nonce.test.ts
import { NextRequest } from 'next/server'

// Use centralized env helper (this file globally mocks @config/server.env)
import {
  resetModulesAndSeed,
  seedServerTest,
  saveEnv,
  restoreEnv,
} from '../../../../test/helpers/env'

import * as siweServer from '@/app/lib/siwe/siwe.server'
import * as rateLimitServer from '@/app/lib/rateLimit/rateLimit.server'

// Hoisted module mocks
vi.mock('@/app/lib/siwe/siwe.server')
vi.mock('@/app/lib/rateLimit/rateLimit.server')
vi.mock('@/app/lib/state/client', () => ({
  isStateServiceEnabled: vi.fn(() => false),
  getStateClient: vi.fn(() => ({
    storeNonce: vi.fn(),
    getNonce: vi.fn(),
    consumeNonce: vi.fn(),
  })),
}))

// Mock the DTO schema to avoid validation issues in tests
vi.mock('@/app/schemas/dto/nonce.dto', async () => {
  const actual = await vi.importActual<typeof import('@/app/schemas/dto/nonce.dto')>('@/app/schemas/dto/nonce.dto')
  return {
    ...actual,
    NonceResponseSchema: {
      parse: (data: any) => data, // Pass through without validation
    },
  }
})

let GETCurrent: (req: NextRequest) => Promise<Response>
let savedEnv: NodeJS.ProcessEnv

describe('GET /api/nonce', () => {
  beforeAll(async () => {
    savedEnv = saveEnv()
    resetModulesAndSeed(seedServerTest, {
      NEXT_PUBLIC_ACTIVE_CHAIN: 'sepolia',
      NEXT_PUBLIC_DOMAIN: 'localhost:3000',
      NODE_ENV: 'test',
    })
    const route = await import('../route')
    GETCurrent = route.GET
  })

  afterAll(() => {
    restoreEnv(savedEnv)
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  it('returns 501 when SIWE is disabled', async () => {
    vi.mocked(siweServer.isSiweEnabled).mockReturnValue(false)
    
    const req = new NextRequest('http://localhost:3000/api/nonce')
    const response = await GETCurrent(req)
    const data = await response.json()
    
    expect(response.status).toBe(501)
    // problem+json now: error message is in `title`
    expect(data.title).toBe('SIWE not enabled')
  })
  
  it('returns 429 when rate limited', async () => {
    vi.mocked(siweServer.isSiweEnabled).mockReturnValue(true)
    vi.mocked(rateLimitServer.checkRateLimitWithNonce).mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 60000
    })
    
    const req = new NextRequest('http://localhost:3000/api/nonce')
    const response = await GETCurrent(req)
    const data = await response.json()
    
    expect(response.status).toBe(429)
    // problem+json title for the summary, detail explains context
    expect(data.title).toBe('Too many requests')
    expect(response.headers.get('Retry-After')).toBeTruthy()
  })
  
  it('returns existing nonce from rate limit check', async () => {
    vi.mocked(siweServer.isSiweEnabled).mockReturnValue(true)
    vi.mocked(rateLimitServer.checkRateLimitWithNonce).mockResolvedValue({
      success: true,
      nonce: 'existing-nonce'
    })
    vi.mocked(rateLimitServer.getIdentifier).mockReturnValue('192.168.1.1')
    
    const req = new NextRequest('http://localhost:3000/api/nonce')
    const response = await GETCurrent(req)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.nonce).toBe('existing-nonce')
    expect(siweServer.generateNonce).not.toHaveBeenCalled()
  })
  
  it('generates new nonce when none exists', async () => {
    vi.mocked(siweServer.isSiweEnabled).mockReturnValue(true)
    vi.mocked(rateLimitServer.checkRateLimitWithNonce).mockResolvedValue({
      success: true
    })
    vi.mocked(rateLimitServer.getIdentifier).mockReturnValue('192.168.1.1')
    vi.mocked(siweServer.generateNonce).mockResolvedValue({
      value: 'new-nonce',
      expiresAt: new Date(Date.now() + 300000),
      identifier: '192.168.1.1'
    })
    
    const req = new NextRequest('http://localhost:3000/api/nonce')
    const response = await GETCurrent(req)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.nonce).toBe('new-nonce')
    expect(siweServer.generateNonce).toHaveBeenCalledWith({
      identifier: '192.168.1.1',
      ttlSeconds: 300
    })
  })
  
  it('returns 500 when nonce generation fails', async () => {
    vi.mocked(siweServer.isSiweEnabled).mockReturnValue(true)
    vi.mocked(rateLimitServer.checkRateLimitWithNonce).mockResolvedValue({
      success: true
    })
    vi.mocked(rateLimitServer.getIdentifier).mockReturnValue('192.168.1.1')
    vi.mocked(siweServer.generateNonce).mockRejectedValue(new Error('Redis connection failed'))
    
    const req = new NextRequest('http://localhost:3000/api/nonce')
    const response = await GETCurrent(req)
    const data = await response.json()
    
    expect(response.status).toBe(500)
    expect(data.title).toBe('Failed to generate nonce')
    expect(siweServer.generateNonce).toHaveBeenCalledWith({
      identifier: '192.168.1.1',
      ttlSeconds: 300
    })
  })
})