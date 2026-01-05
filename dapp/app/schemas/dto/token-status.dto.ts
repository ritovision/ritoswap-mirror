// app/schemas/dto/token-status.dto.ts
import { z } from 'zod';
import { TokenIdStringSchema } from '@/app/config/security.public';

/**
 * Token Status DTOs with Zod validation
 */

/**
 * Request params schema (tokenId from path param → number)
 */
export const TokenStatusParamsSchema = z.object({
  tokenId: TokenIdStringSchema,
});
export type TokenStatusParams = z.infer<typeof TokenStatusParamsSchema>;

/**
 * Successful token status response
 */
export const TokenStatusResponseSchema = z.object({
  /** Number of tokens found (0 or 1) */
  count: z.number().int().min(0).max(1),
  /** Whether the token exists on-chain */
  exists: z.boolean(),
  /** Whether the token has been used for gated access */
  used: z.boolean(),
  /** Address that used the token (if used) */
  usedBy: z.string().nullable(),
  /** ISO timestamp when token was used (if used) */
  usedAt: z.string().datetime().nullable(),
});
export type TokenStatusResponse = z.infer<typeof TokenStatusResponseSchema>;

/**
 * Invalid token ID error response
 */
export const InvalidTokenIdErrorSchema = z.object({
  type: z.literal('https://ritoswap.com/errors/invalid-token-id'),
  title: z.literal('Invalid token ID'),
  status: z.literal(400),
  detail: z.string().optional(),
});
export type InvalidTokenIdError = z.infer<typeof InvalidTokenIdErrorSchema>;

/**
 * Helper to create a token status response
 */
export function createTokenStatusResponse(
  exists: boolean,
  used: boolean = false,
  usedBy: string | null = null,
  usedAt: Date | string | null = null
): TokenStatusResponse {
  return TokenStatusResponseSchema.parse({
    count: exists ? 1 : 0,
    exists,
    used,
    usedBy,
    usedAt: usedAt ? (typeof usedAt === 'string' ? usedAt : usedAt.toISOString()) : null,
  });
}

/**
 * Helper to validate and parse token ID from params
 */
export function parseTokenIdParam(params: { tokenId: string }): {
  success: true;
  tokenId: number;
} | {
  success: false;
  error: string;
} {
  const result = TokenStatusParamsSchema.safeParse(params);
  if (result.success) {
    return { success: true, tokenId: result.data.tokenId };
  } else {
    const issue = result.error.issues[0];
    return { success: false, error: issue?.message || 'Invalid token ID' };
  }
}
