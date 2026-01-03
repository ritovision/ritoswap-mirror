// tests/rate-limit.domain.test.ts
import { toRateLimitMetadata, toRateLimitHeaders } from '@/app/schemas/domain/rate-limit.domain'

describe('rate limit helpers', () => {
  it('returns null when required fields missing', () => {
    expect(toRateLimitMetadata({ success: true })).toBeNull()
  })

  it('computes retryAfter with ceil and min 1', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
    const reset = new Date('2024-01-01T00:00:02.100Z').getTime()
    const meta = toRateLimitMetadata({ success: true, limit: 10, remaining: 3, reset })!
    expect(meta.retryAfter).toBe(3) // ceil(2.1) = 3
    const headers = toRateLimitHeaders({ success: true, limit: 10, remaining: 3, reset })!
    expect(headers['Retry-After']).toBe('3')
    vi.useRealTimers()
  })
})
