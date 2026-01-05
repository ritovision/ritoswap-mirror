import { z } from 'zod'
import { requestJSON } from '@/app/lib/client/api/_http'

const SuccessSchema = z.object({ hello: z.string() })
const ErrorSchema = z.object({ error: z.string() })

function resp(body: unknown, init: ResponseInit) {
  return new Response(body === undefined ? null : JSON.stringify(body), init)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestJSON', () => {
  it('returns ok:true on 2xx with valid success shape and rate limit info', async () => {
    const headers = new Headers({
      'X-RateLimit-Limit': '10',
      'X-RateLimit-Remaining': '7',
      'Retry-After': '3',
    })
    ;(fetch as any).mockResolvedValueOnce(resp({ hello: 'world' }, { status: 200, headers }))
    const res = await requestJSON('/x', { method: 'GET' }, SuccessSchema, ErrorSchema)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data.hello).toBe('world')
      expect(res.rateLimit).toEqual({ limit: 10, remaining: 7, retryAfter: 3 })
    }
  })

  it('returns ok:false UnknownApiError when 2xx but shape invalid', async () => {
    ;(fetch as any).mockResolvedValueOnce(resp({ nope: 1 }, { status: 200 }))
    const res = await requestJSON('/x', { method: 'GET' }, SuccessSchema, ErrorSchema)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect((res.error as any).error).toBe('Invalid success response shape')
    }
  })

  it('returns error branch when non-2xx matches error schema', async () => {
    ;(fetch as any).mockResolvedValueOnce(resp({ error: 'bad' }, { status: 400 }))
    const res = await requestJSON('/x', { method: 'GET' }, SuccessSchema, ErrorSchema)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.status).toBe(400)
      expect((res.error as any).error).toBe('bad')
    }
  })

  it('returns UnknownApiError when non-2xx shape invalid', async () => {
    ;(fetch as any).mockResolvedValueOnce(resp({ what: 'huh' }, { status: 500 }))
    const res = await requestJSON('/x', { method: 'GET' }, SuccessSchema, ErrorSchema)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect((res.error as any).error).toBe('Invalid error response shape')
    }
  })

  it('handles empty body', async () => {
    ;(fetch as any).mockResolvedValueOnce(new Response(null, { status: 204 }))
    const res = await requestJSON('/x', { method: 'GET' }, SuccessSchema, ErrorSchema)
    expect(res.ok).toBe(false) // 204 + no body won’t match success schema
  })
})
