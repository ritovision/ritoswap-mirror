import {
  TokenStatusResponseSchema,
  InvalidTokenIdErrorSchema,
  createTokenStatusResponse,
  parseTokenIdParam,
} from '@/app/schemas/dto/token-status.dto'

describe('TokenStatusResponseSchema', () => {
  it('validates used=false shape', () => {
    const ok = {
      count: 1,
      exists: true,
      used: false,
      usedBy: null,
      usedAt: null,
    }
    expect(TokenStatusResponseSchema.safeParse(ok).success).toBe(true)
  })

  it('validates used=true with ISO date', () => {
    const ok = {
      count: 1,
      exists: true,
      used: true,
      usedBy: '0x1234',
      usedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    }
    expect(TokenStatusResponseSchema.safeParse(ok).success).toBe(true)
  })
})

describe('createTokenStatusResponse', () => {
  it('normalizes usedAt and sets count', () => {
    const d = new Date('2024-01-01T00:00:00Z')
    const res = createTokenStatusResponse(true, true, '0xabc', d)
    expect(res.count).toBe(1)
    expect(res.usedAt).toBe(d.toISOString())
  })

  it('works with string usedAt and exists=false', () => {
    const res = createTokenStatusResponse(false, false, null, null)
    expect(res.count).toBe(0)
    expect(res.exists).toBe(false)
    expect(res.usedAt).toBeNull()
  })
})

describe('parseTokenIdParam', () => {
  it('parses valid path param', () => {
    const r = parseTokenIdParam({ tokenId: '123' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.tokenId).toBe(123)
  })

  it('fails on invalid param', () => {
    const r = parseTokenIdParam({ tokenId: 'abc' as any })
    expect(r.success).toBe(false)
    if (!r.success) expect(typeof r.error).toBe('string')
  })
})

describe('InvalidTokenIdErrorSchema', () => {
  it('accepts canonical shape', () => {
    const ok = {
      type: 'https://ritoswap.com/errors/invalid-token-id',
      title: 'Invalid token ID',
      status: 400,
      detail: 'Token must be numeric',
    }
    expect(InvalidTokenIdErrorSchema.safeParse(ok).success).toBe(true)
  })
})
