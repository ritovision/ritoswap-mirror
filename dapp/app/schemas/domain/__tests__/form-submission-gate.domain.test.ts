// app/schemas/domain/__tests__/form-submission-gate.domain.test.ts
import { validateFormSubmission, formatAddress } from '@/app/schemas/domain/form-submission-gate.domain'

describe('validateFormSubmission', () => {
  const base = {
    tokenId: '123',
    message: 'hi',
    signature: '0x' + 'a'.repeat(130),
    address: '0x1234567890abcdef1234567890abcdef12345678',
    timestamp: Date.now(),
  }

  it('accepts a valid payload', () => {
    const res = validateFormSubmission(base)
    expect(res.isValid).toBe(true)
    expect(res.tokenIdNum).toBe(123)
    expect(res.tokenIdBigInt).toEqual(BigInt(123)) // avoid BigInt literal
  })

  it('rejects missing fields and gives codes', () => {
    expect(validateFormSubmission({ ...base, tokenId: undefined }).errorCode).toBe('MISSING_FIELD')
    expect(validateFormSubmission({ ...base, signature: undefined }).errorCode).toBe('MISSING_FIELD')
    expect(validateFormSubmission({ ...base, address: undefined }).errorCode).toBe('MISSING_FIELD')
    expect(validateFormSubmission({ ...base, timestamp: 'x' as any }).errorCode).toBe('INVALID_TYPE')
  })

  it('rejects invalid tokenId formats and range', () => {
    expect(validateFormSubmission({ ...base, tokenId: 'abc' }).errorCode).toBe('INVALID_TOKEN_FORMAT')
    const tooBig = (BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1)).toString() // avoid 1n literal
    expect(validateFormSubmission({ ...base, tokenId: tooBig }).errorCode).toBe('TOKEN_OUT_OF_RANGE')
  })

  it('enforces message length', () => {
    const ok = { ...base, message: 'a'.repeat(10000) }
    const bad = { ...base, message: 'a'.repeat(10001) }
    expect(validateFormSubmission(ok).isValid).toBe(true)
    expect(validateFormSubmission(bad).errorCode).toBe('MESSAGE_TOO_LONG')
  })
})

describe('formatAddress', () => {
  it('shortens long 0x addresses', () => {
    const a = '0x1234567890abcdef1234567890abcdef12345678'
    expect(formatAddress(a)).toBe('0x1234…5678') // single ellipsis char
  })
  it('passes through non-0x or short strings', () => {
    expect(formatAddress('abc')).toBe('abc')
    expect(formatAddress(undefined)).toBe('')
  })
})
