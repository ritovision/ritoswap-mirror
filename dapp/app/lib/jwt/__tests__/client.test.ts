
/**
 * Helper to import the SUT with controlled mocks for jose.decodeJwt and the Zod schema parser.
 */
async function importSut(opts: {
  decodeJwtImpl: (token: string) => any
  parseImpl?: (p: any) => any
}) {
  vi.resetModules()

  // Mock jose.decodeJwt
  const decodeJwt = vi.fn((token: string) => opts.decodeJwtImpl(token))
  vi.doMock('jose', () => ({ decodeJwt }))

  // Mock schema parser (default: identity)
  const parseSpy = vi.fn((p: any) => (opts.parseImpl ? opts.parseImpl(p) : p))
  vi.doMock('@schemas/domain/jwt.domain', () => ({
    AccessTokenPayloadSchema: { parse: parseSpy },
  }))

  const mod = await import('../client')
  return { ...mod, decodeJwt, parseSpy }
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('app/lib/jwt/client.ts', () => {
  it('setStoredToken / getStoredToken / clearStoredToken roundtrip', async () => {
    const { setStoredToken, getStoredToken, clearStoredToken } = await importSut({
      decodeJwtImpl: () => ({}),
    })

    expect(getStoredToken()).toBeNull()

    setStoredToken('abc.123')
    expect(getStoredToken()).toBe('abc.123')

    clearStoredToken()
    expect(getStoredToken()).toBeNull()
  })

  it('decodeAccessToken: returns parsed payload on success', async () => {
    const payload = {
      kind: 'access',
      auth: 'siwe',
      iss: 'issuer',
      aud: ['aud'],
      sub: '0xabc' as `0x${string}`,
      iat: 100,
      exp: 200,
      jti: 'j',
      scopes: ['read'],
      siwe: { address: '0xabc', domain: 'ex', chainId: 1, nonce: 'n', issuedAt: 't' },
      siwe_hash: '0xhash',
    }
    const { decodeAccessToken, decodeJwt, parseSpy } = await importSut({
      decodeJwtImpl: () => payload,
    })

    const out = decodeAccessToken('any.token')
    expect(out).toEqual(payload)
    expect(decodeJwt).toHaveBeenCalledWith('any.token')
    expect(parseSpy).toHaveBeenCalledWith(payload)
  })

  it('decodeAccessToken: returns null if decodeJwt throws', async () => {
    const { decodeAccessToken } = await importSut({
      decodeJwtImpl: () => {
        throw new Error('bad token')
      },
    })
    expect(decodeAccessToken('nope')).toBeNull()
  })

  it('decodeAccessToken: returns null if schema parse fails', async () => {
    const { decodeAccessToken } = await importSut({
      decodeJwtImpl: () => ({ foo: 'bar' }),
      parseImpl: () => {
        throw new Error('zod error')
      },
    })
    expect(decodeAccessToken('nope')).toBeNull()
  })

  it('isExpired: true when exp <= now, false when exp > now', async () => {
    vi.setSystemTime(new Date('2024-01-01T00:00:30Z')) // epoch 1704067200 + 30s
    const nowSec = Math.floor(Date.now() / 1000)

    const { isExpired } = await importSut({
      decodeJwtImpl: () => ({
        exp: nowSec + 10, // not expired
      }),
    })
    expect(isExpired('t1')).toBe(false)

    const { isExpired: isExpired2 } = await importSut({
      decodeJwtImpl: () => ({
        exp: nowSec, // exactly now -> expired
      }),
    })
    expect(isExpired2('t2')).toBe(true)

    const { isExpired: isExpired3 } = await importSut({
      decodeJwtImpl: () => {
        throw new Error('bad token')
      },
    })
    expect(isExpired3('t3')).toBe(true) // invalid => treated as expired
  })

  it('secondsUntilExpiry: returns remaining seconds, clamps to 0 if past, null if invalid', async () => {
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
    const nowSec = Math.floor(Date.now() / 1000)

    const { secondsUntilExpiry } = await importSut({
      decodeJwtImpl: () => ({ exp: nowSec + 30 }),
    })
    expect(secondsUntilExpiry('t1')).toBe(30)

    const { secondsUntilExpiry: secondsUntilExpiry2 } = await importSut({
      decodeJwtImpl: () => ({ exp: nowSec - 5 }),
    })
    expect(secondsUntilExpiry2('t2')).toBe(0)

    const { secondsUntilExpiry: secondsUntilExpiry3 } = await importSut({
      decodeJwtImpl: () => {
        throw new Error('nope')
      },
    })
    expect(secondsUntilExpiry3('t3')).toBeNull()
  })

  it('getSubjectAddress: returns the sub (address) or null if invalid', async () => {
    const { getSubjectAddress } = await importSut({
      decodeJwtImpl: () => ({ sub: '0xDeF' }),
    })
    expect(getSubjectAddress('t1')).toBe('0xDeF')

    const { getSubjectAddress: getSubjectAddress2 } = await importSut({
      decodeJwtImpl: () => {
        throw new Error('bad')
      },
    })
    expect(getSubjectAddress2('t2')).toBeNull()
  })

  it('hasScopes: true iff all required present; false on invalid token', async () => {
    const { hasScopes } = await importSut({
      decodeJwtImpl: () => ({ scopes: ['read', 'write'] }),
    })
    expect(hasScopes('t', [])).toBe(true)
    expect(hasScopes('t', ['read'])).toBe(true)
    expect(hasScopes('t', ['read', 'write'])).toBe(true)
    expect(hasScopes('t', ['admin'])).toBe(false)

    const { hasScopes: hasScopes2 } = await importSut({
      decodeJwtImpl: () => {
        throw new Error('invalid')
      },
    })
    // Note: implementation returns false if token is invalid (even when required scopes is empty)
    expect(hasScopes2('t', [])).toBe(false)
  })
})
