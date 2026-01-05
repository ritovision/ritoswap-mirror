
/**
 * Mocks
 */
const parseSpy = vi.fn((p: any) => p)
vi.mock('@schemas/domain/jwt.domain', () => ({
  AccessTokenPayloadSchema: { parse: parseSpy },
}))

// Mock viem keccak256 to be deterministic and spy on input
const keccakSpy = vi.fn((_bytes: Uint8Array) => '0xHASHED')
vi.mock('viem', () => ({
  keccak256: (bytes: Uint8Array) => keccakSpy(bytes),
}))

let restore: (() => void) | null = null

beforeEach(() => {
  vi.clearAllMocks()
  // Spy (preferred) or stub crypto.randomUUID
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    const spy = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('uuid-1' as any)
    restore = () => spy.mockRestore()
  } else {
    // Fallback if crypto is missing (unlikely in happy-dom)
    vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValue('uuid-1') } as any)
    restore = () => {

      delete (globalThis as any).crypto
    }
  }
})

afterEach(() => {
  restore?.()
  restore = null
})

describe('app/lib/jwt/claims.ts', () => {
  it('buildAccessClaims: builds strict payload (lowercases address, adds iat/exp/jti, hashes SIWE)', async () => {
    const { buildAccessClaims } = await import('../claims')

    const nowSec = 1700000000
    const input = {
      auth: 'siwe' as const,
      siweParsed: {
        address: '0xAbC123',
        domain: 'example.com',
        chainId: 1,
        nonce: 'nonce-1',
        issuedAt: '2023-01-01T00:00:00.000Z',
      },
      originalSiweMessage: 'sign me pls',
      issuer: 'https://issuer.test',
      audiences: ['https://aud1', 'https://aud2'],
      accessTtlSec: 3600,
      scopes: ['read', 'write'],
      tokenId: 'tok-1',
      nowSec,
    }

    const out = buildAccessClaims(input)

    // kind/auth
    expect(out.kind).toBe('access')
    expect(out.auth).toBe('siwe')

    // iss/aud/sub lowercased
    expect(out.iss).toBe(input.issuer)
    expect(out.aud).toEqual(input.audiences)
    expect(out.sub).toBe('0xabc123')

    // iat/exp derived
    expect(out.iat).toBe(nowSec)
    expect(out.exp).toBe(nowSec + 3600)

    // jti from randomUUID
    expect(out.jti).toBe('uuid-1')

    // scopes + tokenId passthrough
    expect(out.scopes).toEqual(['read', 'write'])
    expect(out.tokenId).toBe('tok-1')

    // siwe projection: preserves fields, lowercases address
    expect(out.siwe).toEqual({
      address: '0xabc123',
      domain: 'example.com',
      chainId: 1,
      nonce: 'nonce-1',
      issuedAt: '2023-01-01T00:00:00.000Z',
    })

    // siwe_hash computed over TextEncoder(originalSiweMessage)
    const enc = new TextEncoder().encode(input.originalSiweMessage)
    expect(keccakSpy).toHaveBeenCalledTimes(1)
    const passedBytes = keccakSpy.mock.calls[0][0] as Uint8Array
    expect(Array.from(passedBytes)).toEqual(Array.from(enc))
    expect(out.siwe_hash).toBe('0xHASHED')

    // Zod schema parse called with the built payload
    expect(parseSpy).toHaveBeenCalledTimes(1)
    expect(parseSpy).toHaveBeenCalledWith(out)
  })

  it('buildAccessClaims: defaults scopes to [] when not provided', async () => {
    const { buildAccessClaims } = await import('../claims')

    const out = buildAccessClaims({
      auth: 'legacy',
      siweParsed: {
        address: '0xDeF',
        domain: 'd',
        chainId: 10,
        nonce: 'legacy',
        issuedAt: '2024-01-01T00:00:00.000Z',
      },
      originalSiweMessage: 'msg',
      issuer: 'iss',
      audiences: ['aud'],
      accessTtlSec: 1,
      nowSec: 100,
    })

    expect(out.scopes).toEqual([])
  })

  it('legacyProjection: builds SIWE-like shape with lowercased address and ISO issuedAt', async () => {
    const { legacyProjection } = await import('../claims')

    const proj = legacyProjection({
      address: '0xABCDEF' as `0x${string}`,
      domain: 'example.org',
      chainId: 8453,
      issuedAtMs: Date.UTC(2024, 0, 2, 3, 4, 5), // Jan 2 2024 03:04:05 UTC
    })

    expect(proj).toEqual({
      address: '0xabcdef',
      domain: 'example.org',
      chainId: 8453,
      nonce: 'legacy',
      issuedAt: new Date(Date.UTC(2024, 0, 2, 3, 4, 5)).toISOString(),
    })
  })
})
