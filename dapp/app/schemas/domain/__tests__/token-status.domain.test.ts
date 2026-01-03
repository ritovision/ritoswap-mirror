import {
  validateTokenId,
  formatTokenAddress,
  formatTokenUsageDate,
} from '@/app/schemas/domain/token-status.domain'

describe('validateTokenId', () => {
  it('accepts numeric string', () => {
    const res = validateTokenId('123')
    expect(res.isValid).toBe(true)
    expect(res.tokenId).toBe(123)
  })

  it('rejects non-numeric', () => {
    const res = validateTokenId('abc')
    expect(res.isValid).toBe(false)
  })

  it('rejects values beyond MAX_SAFE_INTEGER', () => {
    const tooBig = (BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1)).toString()
    const res = validateTokenId(tooBig)
    expect(res.isValid).toBe(false)
  })
})

describe('formatTokenAddress', () => {
  it('formats long addresses with ellipsis', () => {
    const a = '0x1234567890abcdef1234567890abcdef12345678'
    expect(formatTokenAddress(a)).toBe('0x1234...5678')
  })

  it('returns N/A when null', () => {
    expect(formatTokenAddress(null)).toBe('N/A')
  })

  it('passes short strings through', () => {
    expect(formatTokenAddress('0x123')).toBe('0x123')
  })
})

describe('formatTokenUsageDate', () => {
  it('returns ISO string for Date', () => {
    const d = new Date('2024-01-01T00:00:00Z')
    expect(formatTokenUsageDate(d)).toBe(d.toISOString())
  })

  it('normalizes string date', () => {
    const s = '2024-01-01T00:00:00.000Z'
    expect(formatTokenUsageDate(s)).toBe(new Date(s).toISOString())
  })

  it('returns null when null', () => {
    expect(formatTokenUsageDate(null)).toBeNull()
  })
})
