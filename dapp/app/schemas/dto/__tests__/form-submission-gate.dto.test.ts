// app/schemas/dto/__tests__/form-submission-gate.dto.test.ts
import { parseFormSubmissionRequest, createFormSubmissionSuccess } from '@/app/schemas/dto/form-submission-gate.dto'

const addr = '0x1234567890abcdef1234567890abcdef12345678'
const sig = '0x' + 'a'.repeat(130)

describe('form-submission-gate DTO', () => {
  it('parses happy path and coerces tokenId to string', () => {
    const res = parseFormSubmissionRequest({
      tokenId: 123,
      message: 'hello',
      signature: sig,
      address: addr,
      timestamp: Date.now(),
    })
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.tokenId).toBe('123')
    }
  })

  it('returns field name on validation error', () => {
    const res = parseFormSubmissionRequest({
      tokenId: '1',
      message: 'hi',
      signature: sig,
      address: 'bad',
      timestamp: Date.now(),
    })
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.field).toBe('address')
    }
  })

  it('creates success response shape', () => {
    expect(createFormSubmissionSuccess()).toEqual({ success: true, message: 'Access granted' })
  })
})
