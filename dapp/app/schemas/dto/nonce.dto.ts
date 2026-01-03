// app/schemas/dto/nonce.dto.ts
import { z } from 'zod'
import { ErrorResponseSchema, ProblemDetailsSchema } from './common.dto'
import { NonceSchema } from '@/app/config/security.public'

/**
 * Successful nonce response
 */
export const NonceResponseSchema = z.object({
  /** Generated nonce value (exactly length defined in security.public.ts) */
  nonce: NonceSchema,
})
export type NonceResponseDTO = z.infer<typeof NonceResponseSchema>

/**
 * Error responses from nonce endpoint
 */
export const NonceErrorResponseSchema = z.union([ErrorResponseSchema, ProblemDetailsSchema])
export type NonceErrorResponseDTO = z.infer<typeof NonceErrorResponseSchema>

export function isNonceError(data: unknown): data is NonceErrorResponseDTO {
  return NonceErrorResponseSchema.safeParse(data).success
}

export function isNonceSuccess(data: unknown): data is NonceResponseDTO {
  return NonceResponseSchema.safeParse(data).success
}
