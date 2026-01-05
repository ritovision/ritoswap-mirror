// app/lib/http/response.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  ProblemDetailsSchema, 
  type ProblemDetails,
  type ErrorResponse,
  ErrorResponseSchema
} from '@schemas/dto/common.dto';
import type { RateLimitCheckResult } from '@schemas/domain/rate-limit.domain';
import { toRateLimitMetadata, toRateLimitHeaders } from '@schemas/domain/rate-limit.domain';

/**
 * Standard no-cache headers for API responses
 */
export const NO_CACHE_HEADERS: HeadersInit = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0, s-maxage=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store',
};

/**
 * Create a no-cache JSON response
 */
export function noCacheJson<T>(body: T, init: ResponseInit = {}): NextResponse {
  const headers = { ...NO_CACHE_HEADERS, ...(init.headers || {}) };
  return NextResponse.json(body, { ...init, headers });
}

/**
 * Create a Problem Details response (RFC 7807)
 * Uses Zod validation to ensure correct shape
 */
export function problemResponse(
  status: number,
  title: string,
  detail?: string,
  extras?: Record<string, unknown>,
  extraHeaders: HeadersInit = {}
): NextResponse {
  const problem: ProblemDetails = ProblemDetailsSchema.parse({
    type: `https://ritoswap.com/errors/${title.toLowerCase().replace(/\s+/g, '-')}`,
    title,
    status,
    detail,
    ...extras
  });

  const headers = {
    'Content-Type': 'application/problem+json',
    ...NO_CACHE_HEADERS,
    ...extraHeaders
  };

  return new NextResponse(JSON.stringify(problem), {
    status: problem.status,
    headers
  });
}

/**
 * Create a simple error response (non-Problem Details)
 * Uses Zod validation
 */
export function errorResponse(
  status: number,
  error: string,
  code?: string,
  rateLimitResult?: RateLimitCheckResult,
  extraHeaders: HeadersInit = {}
): NextResponse {
  const metadata = rateLimitResult ? toRateLimitMetadata(rateLimitResult) : null;
  
  const body: ErrorResponse = ErrorResponseSchema.parse({
    error,
    ...(code && { code }),
    ...(metadata && {
      limit: metadata.limit,
      remaining: metadata.remaining,
      retryAfter: metadata.retryAfter
    })
  });

  const rateLimitHeaders = rateLimitResult ? toRateLimitHeaders(rateLimitResult) : null;
  const headers = {
    ...NO_CACHE_HEADERS,
    ...extraHeaders,
    ...(rateLimitHeaders || {})
  };

  return NextResponse.json(body, { status, headers });
}

/**
 * Create a rate-limited response with proper headers and body
 */
export function rateLimitResponse(
  rateLimitResult: RateLimitCheckResult,
  detail?: string
): NextResponse {
  const metadata = toRateLimitMetadata(rateLimitResult);
  if (!metadata) {
    // Fallback if metadata extraction fails
    return problemResponse(429, 'Too many requests', detail);
  }

  const rateLimitHeaders = toRateLimitHeaders(rateLimitResult);
  
  return problemResponse(
    429,
    'Too many requests',
    detail || 'Rate limit exceeded',
    {
      limit: metadata.limit,
      remaining: metadata.remaining,
      retryAfter: metadata.retryAfter
    },
    rateLimitHeaders || {}
  );
}

/**
 * Helper to validate response bodies at runtime
 * Useful for ensuring API responses match their schemas
 */
export function validateResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  errorMessage = 'Response validation failed'
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(errorMessage, result.error);
    throw new Error(errorMessage);
  }
  return result.data;
}