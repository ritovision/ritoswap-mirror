
/**
 * Base mocks
 */
vi.mock('server-only', () => ({}))

// Minimal schema mock: just returns payload; we spy to ensure it's called.
const parseSpyServer = vi.fn((p: any) => p)
vi.mock('@schemas/domain/jwt.domain', () => ({
  AccessTokenPayloadSchema: { parse: parseSpyServer },
}))

// jose mock: chainable SignJWT, controllable jwtVerify response, key import spies.
let verifyResponse: any = {
  payload: {},
  protectedHeader: { alg: 'HS256' },
}

function SignJWT(this: any, payload: any) {
  const instance = {
    _payload: payload,
    setProtectedHeader: vi.fn().mockReturnThis(),
    setSubject: vi.fn().mockReturnThis(),
    setIssuer: vi.fn().mockReturnThis(),
    setAudience: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    setJti: vi.fn().mockReturnThis(),
    sign: vi.fn(async (_key: any) => 'signed.jwt'),
  }
  ;(SignJWT as any).__lastInstance = instance
  ;(SignJWT as any).__lastPayload = payload
  return instance
}

// Correct typing: one function-type generic; annotate parameters to avoid implicit any.
const jwtVerify = vi.fn<(token: string, key: any, options?: any) => Promise<any>>(
  async (_token: string, _key: any, _options?: any) => verifyResponse,
)
const decodeProtectedHeader = vi.fn((/* token */) => verifyResponse.protectedHeader)
const importPKCS8 = vi.fn(async (_pem: string, _alg: string) => 'MOCK_PRIVATE_KEY' as any)
const importSPKI = vi.fn(async (_pem: string, _alg: string) => 'MOCK_PUBLIC_KEY' as any)

vi.mock('jose', () => ({
  SignJWT,
  jwtVerify,
  decodeProtectedHeader,
  importPKCS8,
  importSPKI,
}))

/**
 * Helper: import server module with a specific (mocked) config.
 * We avoid mutating read-only config by mocking the entire module before import.
 */
type Cfg = {
  alg: 'HS256' | 'RS256'
  secret?: Uint8Array
  issuer: string
  audiences: string[]
  clockToleranceSec: number
  privateKeyPem?: string
  publicKeyPem?: string
}
async function importWithConfig(cfg: Cfg) {
  // Reset module cache so the SUT picks up the mocked config
  vi.resetModules()
  // Mock the config module to return the exact cfg we want
  vi.doMock('@config/jwt.server', () => ({
    jwtServerConfig: cfg as any, // bypass readonly typing
  }))
  const mod = await import('../server')
  return mod
}

describe('app/lib/jwt/server.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyResponse = {
      payload: {},
      protectedHeader: { alg: 'HS256' },
    }
  })

  it('signAccessToken: builds JWT with expected claims and signs with HS256 secret', async () => {
    const cfg: Cfg = {
      alg: 'HS256',
      secret: new Uint8Array([7, 7, 7]),
      issuer: 'https://issuer.example',
      audiences: ['https://aud.example'],
      clockToleranceSec: 0,
    }
    const { signAccessToken } = await importWithConfig(cfg)

    const now = Math.floor(Date.now() / 1000)
    const payload = {
      sub: '0xabc123' as `0x${string}`,
      iat: now,
      exp: now + 60,
      jti: 'jti-1',
      scopes: ['read'],
    } as any

    const token = await signAccessToken(payload)
    expect(token).toBe('signed.jwt')

    const SJ: any = await import('jose')
    const inst: any = (SJ.SignJWT as any).__lastInstance
    const ctorPayload: any = (SJ.SignJWT as any).__lastPayload

    expect(ctorPayload).toBe(payload)
    expect(inst.setProtectedHeader).toHaveBeenCalledWith({ alg: 'HS256' })
    expect(inst.setSubject).toHaveBeenCalledWith(payload.sub)
    expect(inst.setIssuer).toHaveBeenCalledWith(cfg.issuer)
    expect(inst.setAudience).toHaveBeenCalledWith(cfg.audiences)
    expect(inst.setIssuedAt).toHaveBeenCalledWith(payload.iat)
    expect(inst.setExpirationTime).toHaveBeenCalledWith(payload.exp)
    expect(inst.setJti).toHaveBeenCalledWith(payload.jti)
    expect(inst.sign).toHaveBeenCalledWith(cfg.secret)
  })

  it('verifyAccessToken: returns parsed payload and header when alg matches', async () => {
    const cfg: Cfg = {
      alg: 'HS256',
      secret: new Uint8Array([1, 2, 3]),
      issuer: 'iss-x',
      audiences: ['aud-x'],
      clockToleranceSec: 0,
    }
    const samplePayload = {
      sub: '0xdef456',
      iat: 1000,
      exp: 2000,
      jti: 'jti-2',
      scopes: ['read', 'write'],
    }
    verifyResponse = {
      payload: samplePayload,
      protectedHeader: { alg: 'HS256' },
    }

    const { verifyAccessToken } = await importWithConfig(cfg)
    const out = await verifyAccessToken('any.token')

    expect(parseSpyServer).toHaveBeenCalledWith(samplePayload)
    expect(out.payload).toEqual(samplePayload)
    expect(out.header).toEqual({ alg: 'HS256' })
    expect(jwtVerify).toHaveBeenCalledTimes(1)

    // Safe access to third arg with optional chaining
    const call = (jwtVerify.mock.calls[0] ?? []) as [string?, any?, any?]
    const opts = call[2]
    expect(opts?.issuer).toBe('iss-x')
    expect(opts?.audience).toEqual(['aud-x'])
  })

  it('verifyAccessToken: throws on alg mismatch', async () => {
    const cfg: Cfg = {
      alg: 'HS256',
      secret: new Uint8Array([1, 2, 3]),
      issuer: 'iss',
      audiences: ['aud'],
      clockToleranceSec: 0,
    }
    verifyResponse = {
      payload: {
        sub: '0x1',
        iat: 1,
        exp: 2,
        jti: 'x',
        scopes: [],
      },
      protectedHeader: { alg: 'RS256' },
    }

    const { verifyAccessToken } = await importWithConfig(cfg)
    await expect(verifyAccessToken('bad.alg')).rejects.toThrow('JWT alg mismatch')
  })

  it('readBearerFromRequest: extracts Bearer token, case-insensitive header', async () => {
    const cfg: Cfg = {
      alg: 'HS256',
      secret: new Uint8Array([1, 2, 3]),
      issuer: 'iss',
      audiences: ['aud'],
      clockToleranceSec: 0,
    }
    const { readBearerFromRequest } = await importWithConfig(cfg)

    const req1 = new Request('https://ex/', {
      headers: { Authorization: 'Bearer token-123' },
    })
    const req2 = new Request('https://ex/', {
      headers: { authorization: 'Bearer token-456' } as any,
    })
    const req3 = new Request('https://ex/', {
      headers: { Authorization: 'Basic abc' },
    })

    expect(readBearerFromRequest(req1)).toBe('token-123')
    expect(readBearerFromRequest(req2)).toBe('token-456')
    expect(readBearerFromRequest(req3)).toBeNull()
  })

  it('readJwtFromAny: prefers header > body > cookies > query param', async () => {
    const cfg: Cfg = {
      alg: 'HS256',
      secret: new Uint8Array([1, 2, 3]),
      issuer: 'iss',
      audiences: ['aud'],
      clockToleranceSec: 0,
    }
    const { readJwtFromAny } = await importWithConfig(cfg)

    // Header wins over everything else
    const reqHeader = new Request('https://ex/?jwt=q', {
      headers: {
        Authorization: 'Bearer from-header',
        // Note: this Cookie header is ignored by browsers; that's fine here because header wins.
        Cookie: 'access_token=from-cookie; jwt=from-cookie-jwt;',
      } as any,
    })
    expect(readJwtFromAny(reqHeader, { jwt: 'from-body' })).toBe('from-header')

    // Body.jwt
    const reqBody = new Request('https://ex/', { headers: {} as any })
    expect(readJwtFromAny(reqBody, { jwt: 'from-body' })).toBe('from-body')

    // Body.data.jwt
    expect(readJwtFromAny(reqBody, { data: { jwt: 'from-body-nested' } })).toBe('from-body-nested')

    // Cookies: use a fake Request-like object because Cookie is a forbidden request header.
    const fakeCookieReq1 = {
      headers: new Headers({ cookie: 'access_token=from-cookie; jwt=from-cookie-jwt;' }),
      url: 'https://ex/',
    } as unknown as Request
    expect(readJwtFromAny(fakeCookieReq1)).toBe('from-cookie')

    // Cookies: fallback to jwt
    const fakeCookieReq2 = {
      headers: new Headers({ cookie: 'jwt=from-cookie-jwt;' }),
      url: 'https://ex/',
    } as unknown as Request
    expect(readJwtFromAny(fakeCookieReq2)).toBe('from-cookie-jwt')

    // Query param
    const reqQuery = new Request('https://ex/?jwt=from-query')
    expect(readJwtFromAny(reqQuery)).toBe('from-query')

    // Nothing
    const reqNone = new Request('https://ex/')
    expect(readJwtFromAny(reqNone)).toBeNull()
  })

  it('hasAllScopes: true when all required scopes present', async () => {
    const cfg: Cfg = {
      alg: 'HS256',
      secret: new Uint8Array([1, 2, 3]),
      issuer: 'iss',
      audiences: ['aud'],
      clockToleranceSec: 0,
    }
    const { hasAllScopes } = await importWithConfig(cfg)
    const payload = { scopes: ['a', 'b', 'c'] } as any
    expect(hasAllScopes(payload, [])).toBe(true)
    expect(hasAllScopes(payload, ['a'])).toBe(true)
    expect(hasAllScopes(payload, ['a', 'c'])).toBe(true)
    expect(hasAllScopes(payload, ['a', 'd'])).toBe(false)
  })

  it('key caching: RS256 private key is imported only once', async () => {
    const cfg: Cfg = {
      alg: 'RS256',
      issuer: 'iss',
      audiences: ['aud'],
      clockToleranceSec: 0,
      privateKeyPem: '---PRIVATE-KEY---',
      publicKeyPem: '---PUBLIC-KEY---',
    }
    const { signAccessToken } = await importWithConfig(cfg)

    const payload = {
      sub: '0xabc',
      iat: 100,
      exp: 200,
      jti: 'j',
      scopes: [],
    } as any

    await signAccessToken(payload)
    await signAccessToken(payload)

    expect(importPKCS8).toHaveBeenCalledTimes(1)
  })
})
