// app/schemas/dto/common.dto.ts
import { z } from 'zod';

/**
 * Shared DTOs used across multiple endpoints
 */

/**
 * Rate limit information included in error responses
 */
export const RateLimitInfoSchema = z.object({
  /** Maximum requests allowed in the window */
  limit: z.number().int().positive(),
  /** Remaining requests in current window */
  remaining: z.number().int().nonnegative(),
  /** Seconds until the rate limit resets */
  retryAfter: z.number().int().positive(),
});
export type RateLimitInfo = z.infer<typeof RateLimitInfoSchema>;

/**
 * RFC 7807 Problem Details for HTTP APIs
 * Used by noCacheProblemFromParts
 */
export const ProblemDetailsSchema = z.object({
  /** A URI reference that identifies the problem type */
  type: z.string().optional(),
  /** A short, human-readable summary */
  title: z.string(),
  /** The HTTP status code */
  status: z.number().int().min(400).max(599),
  /** A human-readable explanation specific to this occurrence */
  detail: z.string().optional(),
  /** A URI reference that identifies the specific occurrence */
  instance: z.string().optional(),
})
.merge(RateLimitInfoSchema.partial()) // Rate limit fields are optional
.passthrough(); // Allow additional fields

export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

/**
 * Generic error response (simpler alternative to Problem Details)
 */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  /** Optional error code for programmatic handling */
  code: z.string().optional(),
})
.merge(RateLimitInfoSchema.partial());

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Generic success response
 */
export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  /** Optional message */
  message: z.string().optional(),
});
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;

/**
 * Headers that accompany rate-limited responses
 */
export const RateLimitHeadersSchema = z.object({
  'X-RateLimit-Limit': z.string(),
  'X-RateLimit-Remaining': z.string(),
  'Retry-After': z.string(),
});
export type RateLimitHeaders = z.infer<typeof RateLimitHeadersSchema>;