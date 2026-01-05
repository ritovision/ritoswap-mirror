// dapp/app/lib/auth/nonSiweAuth.test.ts
import { type Mock } from 'vitest'
import {
  resetModulesAndSeed,
  seedBase,
} from '@/test/helpers/env'

// ─── 1) Hoisted mocks ──────────────────────────────────────────────────────────
vi.mock('viem', () => ({
  verifyMessage: vi.fn(),
}))

// Mock the new chain config module used by nonSiweAuth.ts
vi.mock('@/app/config/chain', () => ({
  getChainConfig: vi.fn(() => ({ chainId: 1 })),
}))

// ─── 2) Deferred imports (we re-import after seeding env each time) ───────────
let normalizeHost: any
let getRequestHost: any
let getAllowedDomains: any
let buildLegacyExpectedMessage: any
let assertLegacyAuth: any
let getChainConfigMock: Mock

async function loadAuth() {
  const mod = await import('./nonSiweAuth')
  normalizeHost = mod.normalizeHost
  getRequestHost = mod.getRequestHost
  getAllowedDomains = mod.getAllowedDomains
  buildLegacyExpectedMessage = mod.buildLegacyExpectedMessage
  assertLegacyAuth = mod.assertLegacyAuth
  // grab the mocked chain fn instance
  const chainMod = await import('@/app/config/chain')
  getChainConfigMock = chainMod.getChainConfig as unknown as Mock
}

import { verifyMessage } from 'viem'
const verifyMessageMock = verifyMessage as unknown as Mock

// Minimal NextRequest-like builder
function makeReq(opts: {
  host?: string | null
  xfh?: string | null
  path?: string
  method?: string | undefined
} = {}): any {
  const headers = new Headers()
  if (opts.host) headers.set('host', opts.host)
  if (opts.xfh) headers.set('x-forwarded-host', opts.xfh)
  return {
    headers,
    method: opts.method as any, // allow undefined to test fallback
    nextUrl: { pathname: opts.path ?? '/api/test' },
  }
}

beforeEach(async () => {
  // Reset env + modules so publicEnv re-validates against current process.env
  resetModulesAndSeed(seedBase) // seeds NEXT_PUBLIC_DOMAIN='localhost:3000'
  verifyMessageMock.mockReset()
  await loadAuth()
  getChainConfigMock.mockReset()
  getChainConfigMock.mockReturnValue({ chainId: 1 })
})

/* ──────────────────────────────────────────────────────────────────────────── *
 * normalizeHost & getRequestHost
 * ──────────────────────────────────────────────────────────────────────────── */
describe('normalizeHost', () => {
  it('returns null for nullish/empty', () => {
    expect(normalizeHost(undefined)).toBeNull()
    expect(normalizeHost(null)).toBeNull()
    expect(normalizeHost('')).toBeNull()
    expect(normalizeHost('   ')).toBeNull()
  })

  it('lowercases and strips scheme/keeps port', () => {
    expect(normalizeHost('HTTP://EXAMPLE.COM')).toBe('example.com')
    expect(normalizeHost('https://Example.com:3000')).toBe('example.com:3000')
  })

  it('parses host from host/path strings', () => {
    expect(normalizeHost('example.com/path')).toBe('example.com')
  })

  it('handles trailing slashes and invalid-ish values (fallback)', () => {
    expect(normalizeHost('EXAMPLE.com///')).toBe('example.com')
    expect(normalizeHost('::::')).toBe('::::') // invalid URL => fallback, lowercased
  })
})

describe('getRequestHost', () => {
  it('prefers x-forwarded-host over host', () => {
    const req = makeReq({ host: 'site.com', xfh: 'FORWARDED.com' })
    expect(getRequestHost(req)).toBe('forwarded.com')
  })

  it('falls back to host when x-forwarded-host missing', () => {
    const req = makeReq({ host: 'Example.com:8080' })
    expect(getRequestHost(req)).toBe('example.com:8080')
  })

  it('returns null when no host headers', () => {
    const req = makeReq({})
    expect(getRequestHost(req)).toBeNull()
  })
})

/* ──────────────────────────────────────────────────────────────────────────── *
 * getAllowedDomains
 * ──────────────────────────────────────────────────────────────────────────── */
describe('getAllowedDomains', () => {
  it('returns ["localhost:3000"] when env not set (default)', async () => {
    await loadAuth()
    expect(getAllowedDomains()).toEqual(['localhost:3000'])
  })

  it('parses, trims, normalizes, de-dupes', async () => {
    resetModulesAndSeed(seedBase, {
      NEXT_PUBLIC_DOMAIN: ' Example.com , , test.com:3000 , example.com , foo.com/// ',
    })
    await loadAuth()
    expect(getAllowedDomains()).toEqual(['example.com', 'test.com:3000', 'foo.com'])
  })
})

/* ──────────────────────────────────────────────────────────────────────────── *
 * buildLegacyExpectedMessage
 * ──────────────────────────────────────────────────────────────────────────── */
describe('buildLegacyExpectedMessage', () => {
  it('builds the exact multi-line message', () => {
    const msg = buildLegacyExpectedMessage({
      tokenId: '42',
      reqHost: 'example.com',
      path: '/api/do-thing',
      method: 'GET',
      chainId: 1,
      timestamp: 1234567890,
    })
    expect(msg).toBe(
      [
        'I own key #42',
        'Domain: example.com',
        'Path: /api/do-thing',
        'Method: GET',
        'ChainId: 1',
        'Timestamp: 1234567890',
      ].join('\n'),
    )
  })
})

/* ──────────────────────────────────────────────────────────────────────────── *
 * assertLegacyAuth
 * ──────────────────────────────────────────────────────────────────────────── */
describe('assertLegacyAuth', () => {
  it('happy path with allowlist configured and matching host', async () => {
    resetModulesAndSeed(seedBase, { NEXT_PUBLIC_DOMAIN: 'example.com' })
    await loadAuth()

    const now = Date.now()
    const req = makeReq({ host: 'example.com', path: '/api/test', method: 'post' })
    const expectedMessage = buildLegacyExpectedMessage({
      tokenId: '123',
      reqHost: 'example.com',
      path: '/api/test',
      method: 'POST',
      chainId: 1,
      timestamp: now,
    })
    verifyMessageMock.mockResolvedValue(true)

    const result = await assertLegacyAuth({
      request: req,
      address: '0x0000000000000000000000000000000000000001',
      signature: '0xdeadbeef',
      tokenId: '123',
      timestamp: now,
    })

    expect(verifyMessageMock).toHaveBeenCalledWith({
      address: '0x0000000000000000000000000000000000000001',
      message: expectedMessage,
      signature: '0xdeadbeef',
    })
    expect(result).toEqual({
      success: true,
      reqHost: 'example.com',
      chainId: 1,
      expectedMessage,
    })
  })

  it('invalid timestamp => 400 INVALID_TIMESTAMP', async () => {
    const res = await assertLegacyAuth({
      request: makeReq({ host: 'example.com' }),
      address: '0x1',
      signature: '0x2',
      tokenId: '1',
      timestamp: Number.NaN as unknown as number,
    })
    expect(res).toMatchObject({ success: false, status: 400, code: 'INVALID_TIMESTAMP' })
  })

  it('future timestamp beyond leeway => 401 FUTURE_TIMESTAMP', async () => {
    const res = await assertLegacyAuth({
      request: makeReq({ host: 'example.com' }),
      address: '0x1',
      signature: '0x2',
      tokenId: '1',
      timestamp: Date.now() + 10_000,
    })
    expect(res).toMatchObject({ success: false, status: 401, code: 'FUTURE_TIMESTAMP' })
  })

  it('future timestamp within leeway passes', async () => {
    // ensure allowlist passes
    resetModulesAndSeed(seedBase, { NEXT_PUBLIC_DOMAIN: 'example.com' })
    await loadAuth()
    verifyMessageMock.mockResolvedValue(true)

    const now = Date.now()
    const res = await assertLegacyAuth({
      request: makeReq({ host: 'example.com' }),
      address: '0x1',
      signature: '0x2',
      tokenId: '1',
      timestamp: now + 10_000,
      futureLeewayMs: 30_000,
    })
    expect(res).toMatchObject({ success: true })
  })

  it('expired signature => 401 EXPIRED', async () => {
    const res = await assertLegacyAuth({
      request: makeReq({ host: 'example.com' }),
      address: '0x1',
      signature: '0x2',
      tokenId: '1',
      timestamp: Date.now() - 6 * 60 * 1000,
    })
    expect(res).toMatchObject({ success: false, status: 401, code: 'EXPIRED' })
  })

  it('requireAllowlist=true but env not configured for this host => 401 HOST_NOT_ALLOWED', async () => {
    // default allowlist = localhost:3000; request example.com => blocked
    const res = await assertLegacyAuth({
      request: makeReq({ host: 'example.com' }),
      address: '0x1',
      signature: '0x2',
      tokenId: '1',
      timestamp: Date.now(),
      requireAllowlist: true,
    })
    expect(res).toMatchObject({ success: false, status: 401, code: 'HOST_NOT_ALLOWED' })
  })

  it('host not allowed when allowlist required => 401 HOST_NOT_ALLOWED', async () => {
    resetModulesAndSeed(seedBase, { NEXT_PUBLIC_DOMAIN: 'example.com' })
    await loadAuth()
    const res = await assertLegacyAuth({
      request: makeReq({ host: 'evil.com' }),
      address: '0x1',
      signature: '0x2',
      tokenId: '1',
      timestamp: Date.now(),
      requireAllowlist: true,
    })
    expect(res).toMatchObject({ success: false, status: 401, code: 'HOST_NOT_ALLOWED' })
  })

  it('host not allowed when allowlist optional but configured => 401 HOST_NOT_ALLOWED', async () => {
    resetModulesAndSeed(seedBase, { NEXT_PUBLIC_DOMAIN: 'example.com' })
    await loadAuth()
    const res = await assertLegacyAuth({
      request: makeReq({ host: 'evil.com' }),
      address: '0x1',
      signature: '0x2',
      tokenId: '1',
      timestamp: Date.now(),
      requireAllowlist: false,
    })
    expect(res).toMatchObject({ success: false, status: 401, code: 'HOST_NOT_ALLOWED' })
  })

  it('uses x-forwarded-host for allowlist checks', async () => {
    resetModulesAndSeed(seedBase, { NEXT_PUBLIC_DOMAIN: 'allowed.com' })
    await loadAuth()
    verifyMessageMock.mockResolvedValue(true)
    const res = await assertLegacyAuth({
      request: makeReq({ host: 'evil.com', xfh: 'allowed.com' }),
      address: '0x1',
      signature: '0x2',
      tokenId: '1',
      timestamp: Date.now(),
    })
    expect(res).toMatchObject({ success: true, reqHost: 'allowed.com' })
  })

  it('chain config missing => 500 CHAIN_CONFIG', async () => {
    // ensure allowlist passes so we hit chain check
    resetModulesAndSeed(seedBase, { NEXT_PUBLIC_DOMAIN: 'example.com' })
    await loadAuth()
    getChainConfigMock.mockReturnValueOnce({} as any) // no chainId

    const res = await assertLegacyAuth({
      request: makeReq({ host: 'example.com' }),
      address: '0x1',
      signature: '0x2',
      tokenId: '1',
      timestamp: Date.now(),
    })
    expect(res).toMatchObject({ success: false, status: 500, code: 'CHAIN_CONFIG' })
  })

  it('invalid signature (false) => 401 INVALID_SIGNATURE', async () => {
    resetModulesAndSeed(seedBase, { NEXT_PUBLIC_DOMAIN: 'example.com' })
    await loadAuth()
    verifyMessageMock.mockResolvedValue(false)
    const res = await assertLegacyAuth({
      request: makeReq({ host: 'example.com' }),
      address: '0x1',
      signature: '0x2',
      tokenId: '1',
      timestamp: Date.now(),
    })
    expect(res).toMatchObject({ success: false, status: 401, code: 'INVALID_SIGNATURE' })
  })

  it('invalid signature (throws) => 401 INVALID_SIGNATURE', async () => {
    resetModulesAndSeed(seedBase, { NEXT_PUBLIC_DOMAIN: 'example.com' })
    await loadAuth()
    verifyMessageMock.mockRejectedValue(new Error('boom'))
    const res = await assertLegacyAuth({
      request: makeReq({ host: 'example.com' }),
      address: '0x1',
      signature: '0x2',
      tokenId: '1',
      timestamp: Date.now(),
    })
    expect(res).toMatchObject({ success: false, status: 401, code: 'INVALID_SIGNATURE' })
  })

  it('binds method (uppercased) and path; falls back to POST when method undefined', async () => {
    resetModulesAndSeed(seedBase, { NEXT_PUBLIC_DOMAIN: 'example.com' })
    await loadAuth()
    const now = Date.now()

    // Case 1: uppercasing
    const req1 = makeReq({ host: 'example.com', method: 'get', path: '/deep/path' })
    const expected1 = buildLegacyExpectedMessage({
      tokenId: '7',
      reqHost: 'example.com',
      path: '/deep/path',
      method: 'GET',
      chainId: 1,
      timestamp: now,
    })

    // Case 2: undefined method => POST
    const req2 = makeReq({ host: 'example.com', method: undefined, path: '/deep/path' })
    const expected2 = buildLegacyExpectedMessage({
      tokenId: '8',
      reqHost: 'example.com',
      path: '/deep/path',
      method: 'POST',
      chainId: 1,
      timestamp: now,
    })

    verifyMessageMock.mockImplementationOnce(async (args: any) => args.message === expected1)
    const ok1 = await assertLegacyAuth({
      request: req1,
      address: '0x1111111111111111111111111111111111111111',
      signature: '0xsignature',
      tokenId: '7',
      timestamp: now,
    })
    expect(ok1).toMatchObject({ success: true, expectedMessage: expected1 })

    verifyMessageMock.mockImplementationOnce(async (args: any) => args.message === expected2)
    const ok2 = await assertLegacyAuth({
      request: req2,
      address: '0x1111111111111111111111111111111111111111',
      signature: '0xsignature',
      tokenId: '8',
      timestamp: now,
    })
    expect(ok2).toMatchObject({ success: true, expectedMessage: expected2 })
  })

  it('host not allowed when no host headers and allowlist configured by default', async () => {
    verifyMessageMock.mockResolvedValue(true)
    const res = await assertLegacyAuth({
      request: makeReq({}), // no host headers
      address: '0x1',
      signature: '0x2',
      tokenId: '1',
      timestamp: Date.now(),
    })
    expect(res).toMatchObject({ success: false, status: 401, code: 'HOST_NOT_ALLOWED' })
  })
})
