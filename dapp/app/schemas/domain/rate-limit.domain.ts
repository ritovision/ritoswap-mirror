// app/schemas/domain/rate-limit.domain.ts

/**
 * Domain types for rate limiting operations
 */

/**
 * Result from rate limit check
 */
export interface RateLimitCheckResult {
  /** Whether the request is allowed */
  success: boolean;
  /** Maximum requests allowed in the window */
  limit?: number;
  /** Remaining requests in current window */
  remaining?: number;
  /** Unix timestamp (ms) when the rate limit resets */
  reset?: number;
  /** Optional nonce if retrieved during check */
  nonce?: string;
}

/**
 * Rate limit metadata for responses
 */
export interface RateLimitMetadata {
  /** Maximum requests allowed */
  limit: number;
  /** Remaining requests */
  remaining: number;
  /** Seconds until reset */
  retryAfter: number;
}

/**
 * Headers to include in rate-limited responses
 * Using Record for compatibility with HeadersInit
 */
export type RateLimitHeaders = Record<string, string>;

/**
 * Available rate limiter types
 */
export type RateLimiterType = 
  | 'nonce'
  | 'gateAccess'
  | 'formSubmissionGate'
  | 'tokenStatus'
  | 'global';

/**
 * Configuration for rate limiters
 */
export interface RateLimiterConfig {
  /** Number of allowed requests */
  limit: number;
  /** Time window (e.g., '60s', '3600s') - Upstash Duration format */
  window: string;
  /** Redis key prefix */
  prefix: string;
}

/**
 * Helper to convert rate limit result to metadata
 */
export function toRateLimitMetadata(result: RateLimitCheckResult): RateLimitMetadata | null {
  if (!result.limit || result.remaining === undefined || !result.reset) {
    return null;
  }
  
  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  
  return {
    limit: result.limit,
    remaining: result.remaining,
    retryAfter
  };
}

/**
 * Helper to create rate limit headers
 */
export function toRateLimitHeaders(result: RateLimitCheckResult): RateLimitHeaders | null {
  const metadata = toRateLimitMetadata(result);
  if (!metadata) return null;
  
  return {
    'X-RateLimit-Limit': String(metadata.limit),
    'X-RateLimit-Remaining': String(metadata.remaining),
    'Retry-After': String(metadata.retryAfter)
  };
}