// dapp/app/lib/http/__tests__/cors.test.ts
import { NextResponse } from 'next/server'
import { corsHeaders, handleCors, withCors, corsJson } from '../../http/cors'

type FakeReq = { method: string; headers: Headers }

// Build a simple request-like object that preserves headers (unlike undici/NextRequest).
const makeReq = (method: string, origin?: string, acrh?: string): FakeReq => {
  const headers = new Headers()
  if (origin) headers.set('origin', origin)
  if (acrh) headers.set('access-control-request-headers', acrh)
  return { method, headers }
}

describe('CORS utilities', () => {
  describe('corsHeaders', () => {
    it('sets wildcard allow-origin when allowOrigins="*" and credentials=false', () => {
      const req = makeReq('GET', 'https://site.com')
      const h = corsHeaders(req as any, { allowOrigins: '*', allowCredentials: false })
      expect(h.get('Access-Control-Allow-Origin')).toBe('*')
      expect(h.get('Access-Control-Allow-Credentials')).toBeNull()
    })

    it('echoes request origin when allowOrigins="*" and credentials=true', () => {
      const origin = 'https://example.org'
      const req = makeReq('GET', origin)
      const h = corsHeaders(req as any, { allowOrigins: '*', allowCredentials: true })
      expect(h.get('Access-Control-Allow-Origin')).toBe(origin)
      expect(h.get('Access-Control-Allow-Credentials')).toBe('true')
    })

    it('allows when origin is in explicit allow list', () => {
      const origin = 'https://friend.com'
      const req = makeReq('GET', origin)
      const h = corsHeaders(req as any, { allowOrigins: [origin] })
      expect(h.get('Access-Control-Allow-Origin')).toBe(origin)
    })

    it('does not set allow-origin when origin is not allowed', () => {
      const req = makeReq('GET', 'https://evil.com')
      const h = corsHeaders(req as any, { allowOrigins: ['https://good.com'] })
      expect(h.get('Access-Control-Allow-Origin')).toBeNull()
    })

    it('reflects Access-Control-Request-Headers when allowHeaders not provided', () => {
      const req = makeReq('OPTIONS', 'https://x.com', 'X-Custom, Content-Type')
      const h = corsHeaders(req as any, { allowOrigins: '*', allowCredentials: false })
      expect(h.get('Access-Control-Allow-Headers')).toBe('X-Custom, Content-Type')
    })

    it('falls back to default allow headers when none requested', () => {
      const req = makeReq('OPTIONS', 'https://x.com')
      const h = corsHeaders(req as any, { allowOrigins: '*', allowCredentials: false })
      expect(h.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization')
    })

    it('uses explicit allowHeaders when provided', () => {
      const req = makeReq('OPTIONS', 'https://x.com', 'Should-Be-Ignored')
      const h = corsHeaders(req as any, {
        allowOrigins: '*',
        allowHeaders: ['X-One', 'X-Two'],
      })
      expect(h.get('Access-Control-Allow-Headers')).toBe('X-One, X-Two')
    })

    it('sets methods, vary, and max-age (including not setting when negative)', () => {
      const req = makeReq('OPTIONS', 'https://x.com')
      const h = corsHeaders(req as any, {
        allowOrigins: '*',
        allowMethods: ['GET', 'POST'],
        maxAge: 123,
      })
      expect(h.get('Access-Control-Allow-Methods')).toBe('GET, POST')
      expect(h.get('Vary')).toBe('Origin, Access-Control-Request-Method, Access-Control-Request-Headers')
      expect(h.get('Access-Control-Max-Age')).toBe('123')

      const h2 = corsHeaders(req as any, { allowOrigins: '*', maxAge: -1 })
      expect(h2.get('Access-Control-Max-Age')).toBeNull()
    })
  })

  describe('handleCors', () => {
    it('returns 204 for OPTIONS preflight with headers applied', () => {
      const req = makeReq('OPTIONS', 'https://site.com', 'X-Req')
      const res = handleCors(req as any, { allowOrigins: '*', allowCredentials: false })
      expect(res).not.toBeNull()
      expect(res!.status).toBe(204)
      expect(res!.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(res!.headers.get('Access-Control-Allow-Headers')).toBe('X-Req')
    })

    it('returns null for non-OPTIONS methods', () => {
      const req = makeReq('GET', 'https://site.com')
      const res = handleCors(req as any, { allowOrigins: '*' })
      expect(res).toBeNull()
    })
  })

  describe('withCors', () => {
    it('merges cors headers into an existing response', () => {
      const req = makeReq('GET', 'https://friend.com')
      const base = new NextResponse('ok', { status: 200 })
      const merged = withCors(base, req as any, {
        allowOrigins: ['https://friend.com'],
        allowMethods: ['GET'],
      })
      expect(merged.headers.get('Access-Control-Allow-Origin')).toBe('https://friend.com')
      expect(merged.headers.get('Access-Control-Allow-Methods')).toBe('GET')
      expect(merged.status).toBe(200)
    })
  })

  describe('corsJson', () => {
    it('returns a JSON response with CORS headers applied', async () => {
      const req = makeReq('GET', 'https://friend.com')
      const res = corsJson(req as any, { ok: true }, {}, { allowOrigins: ['https://friend.com'] })
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://friend.com')
      const body = await res.json()
      expect(body).toEqual({ ok: true })
      expect(res.headers.get('content-type')).toContain('application/json')
    })
  })
})
