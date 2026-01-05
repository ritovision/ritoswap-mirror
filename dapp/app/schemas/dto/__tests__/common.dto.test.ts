import {
  RateLimitInfoSchema,
  ProblemDetailsSchema,
  ErrorResponseSchema,
  SuccessResponseSchema,
  RateLimitHeadersSchema,
} from '@/app/schemas/dto/common.dto'

describe('RateLimitInfoSchema', () => {
  it('validates positive integers', () => {
    const ok = { limit: 10, remaining: 5, retryAfter: 3 }
    expect(RateLimitInfoSchema.safeParse(ok).success).toBe(true)
  })
})

describe('ProblemDetailsSchema (passthrough + partial rate-limit)', () => {
  it('accepts extra fields and optional RL fields', () => {
    const payload = {
      title: 'Bad Request',
      status: 400,
      type: 'https://example.com/problem',
      instance: '/req/123',
      detail: 'nope',
      // optional rate-limit fields
      remaining: 2,
      // extra unknown field (should passthrough)
      extra: { foo: 'bar' },
    }
    const res = ProblemDetailsSchema.safeParse(payload)
    expect(res.success).toBe(true)
    if (res.success) {
      expect((res.data as any).extra).toEqual({ foo: 'bar' })
      expect(res.data.remaining).toBe(2)
    }
  })
})

describe('ErrorResponseSchema', () => {
  it('accepts error and optional code/ratelimit', () => {
    expect(
      ErrorResponseSchema.safeParse({ error: 'nope', code: 'E_X', limit: 10 }).success
    ).toBe(true)
  })
})

describe('SuccessResponseSchema', () => {
  it('accepts success true and optional message', () => {
    expect(SuccessResponseSchema.safeParse({ success: true, message: 'ok' }).success).toBe(true)
  })
})

describe('RateLimitHeadersSchema', () => {
  it('validates required header keys', () => {
    const headers = {
      'X-RateLimit-Limit': '10',
      'X-RateLimit-Remaining': '5',
      'Retry-After': '3',
    }
    expect(RateLimitHeadersSchema.safeParse(headers).success).toBe(true)
  })
})
