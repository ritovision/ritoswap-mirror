
// mock NonceSchema here so we don't guess its exact constraints
vi.mock('@/app/config/security.public', async () => {
  const { z } = await import('zod')
  return {
    NonceSchema: z.string().min(1),
  }
})

import {
  NonceResponseSchema,
  NonceErrorResponseSchema,
  isNonceSuccess,
  isNonceError,
} from '@/app/schemas/dto/nonce.dto'

describe('nonce DTOs', () => {
  it('isNonceSuccess recognizes valid response', () => {
    const payload = { nonce: 'abc' }
    expect(NonceResponseSchema.safeParse(payload).success).toBe(true)
    expect(isNonceSuccess(payload)).toBe(true)
    expect(isNonceError(payload)).toBe(false)
  })

  it('isNonceError recognizes error shapes', () => {
    const error1 = { error: 'nope' }
    const error2 = { title: 'Bad', status: 400 }
    expect(NonceErrorResponseSchema.safeParse(error1).success).toBe(true)
    expect(NonceErrorResponseSchema.safeParse(error2).success).toBe(true)
    expect(isNonceError(error1)).toBe(true)
    expect(isNonceSuccess(error1)).toBe(false)
  })
})
