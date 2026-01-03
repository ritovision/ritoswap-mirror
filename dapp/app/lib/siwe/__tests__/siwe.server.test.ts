// app/lib/siwe/__tests__/siwe.server.test.ts

// Centralized env helper (globally mocks @config/server.env)
import {
  resetModulesAndSeed,
  seedServerTest,
} from '../../../../test/helpers/env'
import type { Mock } from 'vitest'

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
}

let mockStateServiceEnabled = true

vi.mock('@/app/lib/state/client', () => ({
  getStateClient: () => mockStateClient,
  isStateServiceEnabled: () => mockStateServiceEnabled,
}))

// Keep viem mocked (server no longer relies on it here, but harmless)
vi.mock('viem', () => ({
  verifyMessage: vi.fn()
}))

// Mock the SIWE lib so we can control verify behavior without real crypto
vi.mock('siwe', () => {
  class FakeSiweMessage {
    domain: string
    address: string
    statement?: string
    uri?: string
    version?: string | number
    chainId?: number
    nonce: string
    issuedAt?: string

    constructor(message: string) {
      // Very light parser to extract basic fields used in tests
      this.domain = message.match(/^([^\n]+)\s+wants you to sign in/i)?.[1] ?? ''
      this.address = message.match(/\n(0x[a-fA-F0-9]{40})\s*\n/)?.[1] ?? ''
      this.statement = message.match(/\n\n([\s\S]+?)\n\nURI:/)?.[1] ?? ''
      this.uri = message.match(/URI:\s*([^\n]+)/i)?.[1] ?? ''
      this.version = message.match(/Version:\s*([^\n]+)/i)?.[1] ?? '1'
      this.chainId = Number(message.match(/Chain ID:\s*([^\n]+)/i)?.[1] ?? 1)
      this.nonce = message.match(/Nonce:\s*([A-Za-z0-9]+)/i)?.[1] ?? ''
      this.issuedAt = message.match(/Issued At:\s*([^\n]+)/i)?.[1] ?? new Date().toISOString()
    }

    async verify({ signature, domain, nonce, time }: any) {
      // Simulate common SIWE failures deterministically for testing
      const now = new Date(time ?? new Date().toISOString()).getTime()
      const issued = this.issuedAt ? Date.parse(this.issuedAt) : now
      const tooOld = now - issued > 5 * 60 * 1000 // expire if older than 5 minutes

      if (domain && this.domain && domain !== this.domain) return { success: false }
      if (nonce && this.nonce && nonce !== this.nonce) return { success: false }
      if (tooOld) return { success: false }
      if (typeof signature === 'string' && signature.includes('invalid')) return { success: false }

      return { success: true }
    }
  }

  return { SiweMessage: FakeSiweMessage }
})

describe('SIWE Server Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.values(mockStateClient).forEach((fn) => {
      (fn as Mock | undefined)?.mockReset?.()
    })
    mockStateServiceEnabled = true
    // Baseline env: state worker enabled & configured; domain empty so getDomain uses fallback logic
    resetModulesAndSeed(seedServerTest, {
      NEXT_PUBLIC_ENABLE_STATE_WORKER: 'true',
      STATE_WORKER_URL: 'https://worker.example.dev/state',
      STATE_WORKER_API_KEY: 'test-key',
      NEXT_PUBLIC_DOMAIN: '',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('isSiweEnabled', () => {
    it('returns true when all env vars are properly set', async () => {
      const { isSiweEnabled } = await import('../siwe.server')
      expect(isSiweEnabled()).toBe(true)
    })

    it('returns false when ENABLE_STATE_WORKER is false', async () => {
      // Also clear URL/token so it cannot remain truthy via defaults
      resetModulesAndSeed(seedServerTest, {
        NEXT_PUBLIC_ENABLE_STATE_WORKER: 'false',
        STATE_WORKER_URL: '',
        STATE_WORKER_API_KEY: '',
        NEXT_PUBLIC_DOMAIN: '',
      })
      const { isSiweEnabled } = await import('../siwe.server')
      expect(isSiweEnabled()).toBe(false)
    })

    it('returns false when API URL is missing', async () => {
      resetModulesAndSeed(seedServerTest, {
        NEXT_PUBLIC_ENABLE_STATE_WORKER: 'true',
        STATE_WORKER_URL: '',
        STATE_WORKER_API_KEY: 'test-key',
      })
      const { isSiweEnabled } = await import('../siwe.server')
      expect(isSiweEnabled()).toBeFalsy()
    })

    it('returns false when API key is missing', async () => {
      // Use empty string to simulate "missing"
      resetModulesAndSeed(seedServerTest, {
        NEXT_PUBLIC_ENABLE_STATE_WORKER: 'true',
        STATE_WORKER_URL: 'https://test-api.upstash.io',
        STATE_WORKER_API_KEY: '',
      })
      const { isSiweEnabled } = await import('../siwe.server')
      expect(isSiweEnabled()).toBe(false)
    })
  })

  describe('getDomain', () => {
    it('returns domain from env when set', async () => {
      resetModulesAndSeed(seedServerTest, {
        NEXT_PUBLIC_DOMAIN: 'https://app.ritoswap.com',
      })
      const { getDomain } = await import('../siwe.server')
      expect(getDomain()).toBe('app.ritoswap.com')
    })

    it('strips protocol from domain env', async () => {
      resetModulesAndSeed(seedServerTest, {
        NEXT_PUBLIC_DOMAIN: 'http://localhost:3000',
      })
      const { getDomain } = await import('../siwe.server')
      expect(getDomain()).toBe('localhost:3000')
    })

    it('falls back to request headers (but code now prefers localhost fallback)', async () => {
      // With NEXT_PUBLIC_DOMAIN empty, implementation falls back to 'localhost:3000'
      resetModulesAndSeed(seedServerTest, {
        NEXT_PUBLIC_DOMAIN: '',
      })
      const { getDomain } = await import('../siwe.server')
      const headers = new Headers({ host: 'test.ritoswap.com' })
      expect(getDomain(headers)).toBe('localhost:3000')
    })

    it('falls back to VERCEL_URL (but code now prefers localhost fallback)', async () => {
      resetModulesAndSeed(seedServerTest, {
        NEXT_PUBLIC_DOMAIN: '',
        NEXT_PUBLIC_VERCEL_URL: 'preview.ritoswap.com',
      })
      const { getDomain } = await import('../siwe.server')
      expect(getDomain()).toBe('localhost:3000')
    })

    it('returns localhost:3000 as final fallback', async () => {
      resetModulesAndSeed(seedServerTest, {
        NEXT_PUBLIC_VERCEL_URL: '',
        NEXT_PUBLIC_DOMAIN: '',
      })
      const { getDomain } = await import('../siwe.server')
      expect(getDomain()).toBe('localhost:3000')
    })
  })

  describe('generateNonce', () => {
    it('persists nonce through the state worker client', async () => {
      resetModulesAndSeed(seedServerTest, {
        NEXT_PUBLIC_ENABLE_STATE_WORKER: 'true',
        STATE_WORKER_URL: 'https://worker.example.dev/state',
        STATE_WORKER_API_KEY: 'test-key',
      })

      const { generateNonce } = await import('../siwe.server')
      const nonce = await generateNonce({ identifier: 'test-identifier' })

      expect(typeof nonce.value).toBe('string')
      expect(nonce.value.length).toBeGreaterThan(0)
      expect(nonce.identifier).toBe('test-identifier')
      expect(nonce.expiresAt instanceof Date).toBe(true)

      expect(mockStateClient.storeNonce).toHaveBeenCalledWith(
        'test-identifier',
        nonce.value,
        300,
      )
    })

    it('still returns a nonce when the worker is disabled', async () => {
      resetModulesAndSeed(seedServerTest, {
        NEXT_PUBLIC_ENABLE_STATE_WORKER: 'false',
      })

      const { generateNonce } = await import('../siwe.server')
      const nonce = await generateNonce({ identifier: 'test-identifier' })
      expect(typeof nonce.value).toBe('string')
      expect(mockStateClient.storeNonce).not.toHaveBeenCalled()
    })
  })

  describe('verifyNonce', () => {
  describe('verifyNonce', () => {
    it('verifies and deletes valid nonce', async () => {
      resetModulesAndSeed(seedServerTest, {
        NEXT_PUBLIC_ENABLE_STATE_WORKER: 'true',
        STATE_WORKER_URL: 'https://worker.example.dev/state',
        STATE_WORKER_API_KEY: 'test-key',
      })
      mockStateClient.consumeNonce.mockResolvedValue('test-nonce')

      const { verifyNonce } = await import('../siwe.server')
      const result = await verifyNonce({ identifier: 'test-identifier', nonce: 'test-nonce' })

      expect(result).toEqual({ isValid: true })
      expect(mockStateClient.consumeNonce).toHaveBeenCalledWith('test-identifier')
    })

    it('returns false for invalid nonce', async () => {
      mockStateClient.consumeNonce.mockResolvedValue('different-nonce')

      const { verifyNonce } = await import('../siwe.server')
      const result = await verifyNonce({ identifier: 'test-identifier', nonce: 'test-nonce' })

      expect(result).toEqual({ isValid: false, reason: 'mismatch' })
    })

    it('returns true when the state worker is disabled', async () => {
      resetModulesAndSeed(seedServerTest, {
        NEXT_PUBLIC_ENABLE_STATE_WORKER: 'false',
      })
      mockStateServiceEnabled = false

      const { verifyNonce } = await import('../siwe.server')
      const result = await verifyNonce({ identifier: 'test-identifier', nonce: 'any' })
      expect(result).toEqual({ isValid: true })
      expect(mockStateClient.consumeNonce).not.toHaveBeenCalled()
    })
  })
  describe('verifySiweMessage', () => {
    const validSiweMessage = `app.ritoswap.com wants you to sign in with your Ethereum account:
0x70997970C51812dc3A010C7d01b50e0d17dc79C8

Sign in to access token gate with key #42

URI: https://app.ritoswap.com
Version: 1
Chain ID: 1
Nonce: abc12345
Issued At: ${new Date().toISOString()}`

    it('verifies valid SIWE message', async () => {
      resetModulesAndSeed(seedServerTest, {
        NEXT_PUBLIC_DOMAIN: 'https://app.ritoswap.com',
      })

      const { verifySiweMessage } = await import('../siwe.server')
      const result = await verifySiweMessage({
        message: validSiweMessage,
        signature: '0xvalidsignature',
        nonce: 'abc12345',
        address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        requestHeaders: new Headers({ host: 'app.ritoswap.com' })
      })

      expect(result.success).toBe(true)
      // New API returns parsed data on success
      expect(result.parsed?.domain).toBe('app.ritoswap.com')
      expect(result.parsed?.address.toLowerCase())
        .toBe('0x70997970c51812dc3a010c7d01b50e0d17dc79c8')
      expect(result.parsed?.nonce).toBe('abc12345')
    })

    it('fails on domain mismatch (treated as invalid_signature)', async () => {
      // Leave domain empty -> function uses 'localhost:3000'
      resetModulesAndSeed(seedServerTest, {
        NEXT_PUBLIC_DOMAIN: '',
      })
      const { verifySiweMessage } = await import('../siwe.server')
      const result = await verifySiweMessage({
        message: validSiweMessage,
        signature: '0xvalidsignature',
        nonce: 'abc12345',
        address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        requestHeaders: new Headers({ host: 'app.ritoswap.com' })
      })

      expect(result).toEqual({
        success: false,
        error: 'invalid_signature',
      })
    })

    it('fails on address mismatch (address_mismatch)', async () => {
      resetModulesAndSeed(seedServerTest, {
        NEXT_PUBLIC_DOMAIN: 'https://app.ritoswap.com',
      })
      const { verifySiweMessage } = await import('../siwe.server')
      const result = await verifySiweMessage({
        message: validSiweMessage,
        signature: '0xvalidsignature',
        nonce: 'abc12345',
        address: '0xDifferentAddress',
        requestHeaders: new Headers({ host: 'app.ritoswap.com' })
      })

      expect(result).toEqual({
        success: false,
        error: 'address_mismatch'
      })
    })

    it('fails on nonce mismatch (invalid_signature)', async () => {
      resetModulesAndSeed(seedServerTest, {
        NEXT_PUBLIC_DOMAIN: 'https://app.ritoswap.com',
      })
      const { verifySiweMessage } = await import('../siwe.server')
      const result = await verifySiweMessage({
        message: validSiweMessage,
        signature: '0xvalidsignature',
        nonce: 'wrongnonce',
        address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        requestHeaders: new Headers({ host: 'app.ritoswap.com' })
      })

      expect(result).toEqual({
        success: false,
        error: 'invalid_signature'
      })
    })

    it('fails on expired message (invalid_signature)', async () => {
      const oldDate = new Date()
      oldDate.setMinutes(oldDate.getMinutes() - 10)

      const expiredMessage = validSiweMessage.replace(
        /Issued At: .*/,
        `Issued At: ${oldDate.toISOString()}`
      )

      resetModulesAndSeed(seedServerTest, {
        NEXT_PUBLIC_DOMAIN: 'https://app.ritoswap.com',
      })
      const { verifySiweMessage } = await import('../siwe.server')
      const result = await verifySiweMessage({
        message: expiredMessage,
        signature: '0xvalidsignature',
        nonce: 'abc12345',
        address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        requestHeaders: new Headers({ host: 'app.ritoswap.com' })
      })

      expect(result).toEqual({
        success: false,
        error: 'invalid_signature'
      })
    })

    it('fails on invalid signature (invalid_signature)', async () => {
      resetModulesAndSeed(seedServerTest, {
        NEXT_PUBLIC_DOMAIN: 'https://app.ritoswap.com',
      })

      const { verifySiweMessage } = await import('../siwe.server')
      const result = await verifySiweMessage({
        message: validSiweMessage,
        signature: '0xinvalidsignature',
        nonce: 'abc12345',
        address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        requestHeaders: new Headers({ host: 'app.ritoswap.com' })
      })

      expect(result).toEqual({
        success: false,
        error: 'invalid_signature'
      })
    })

    it('handles malformed messages gracefully', async () => {
      resetModulesAndSeed(seedServerTest, {
        NEXT_PUBLIC_DOMAIN: 'https://app.ritoswap.com',
      })
      const { verifySiweMessage } = await import('../siwe.server')
      const result = await verifySiweMessage({
        message: 'not a valid siwe message',
        signature: '0xsignature',
        nonce: 'nonce',
        address: '0xaddress',
        requestHeaders: new Headers({ host: 'app.ritoswap.com' })
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })
})
  })