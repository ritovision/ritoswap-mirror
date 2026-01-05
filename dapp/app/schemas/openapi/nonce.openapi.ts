// app/schemas/openapi/nonce.openapi.ts
import { z } from '@/app/schemas/zod-openapi';
import { NonceResponseSchema } from '@/app/schemas/dto/nonce.dto';
import { ProblemDetailsSchema } from '@/app/schemas/dto/common.dto';

/**
 * Define all possible responses for the nonce endpoint
 */

// 200 Success
export const NonceSuccessResponseSchema = NonceResponseSchema.openapi({
  description: 'Nonce generated successfully',
  example: {
    nonce: '8f4a2b3c9d1e7a6fb4c8d7e2f9a1c3d5',
  },
});

// 429 Rate Limited (RFC7807)
export const NonceRateLimitResponseSchema = ProblemDetailsSchema.openapi({
  description: 'Rate limit exceeded',
  example: {
    type: 'https://ritoswap.com/errors/too-many-requests',
    title: 'Too many requests',
    status: 429,
    detail: 'Rate limit exceeded for nonce generation',
    limit: 30,
    remaining: 0,
    retryAfter: 60,
  },
});

// 500 Server Error (RFC7807)
export const NonceServerErrorResponseSchema = ProblemDetailsSchema.openapi({
  description: 'Internal server error',
  example: {
    type: 'https://ritoswap.com/errors/failed-to-generate-nonce',
    title: 'Failed to generate nonce',
    status: 500,
    detail: 'An unexpected error occurred while generating the nonce',
  },
});

// 501 Not Implemented (RFC7807)
export const NonceNotImplementedResponseSchema = ProblemDetailsSchema.openapi({
  description: 'SIWE not enabled',
  example: {
    type: 'https://ritoswap.com/errors/siwe-not-enabled',
    title: 'SIWE not enabled',
    status: 501,
    detail: 'SIWE authentication is not configured on this server',
  },
});

// 405 Method Not Allowed (matches runtime handlers with Allow header)
export const MethodNotAllowedResponseSchema = z
  .object({
    error: z.string(),
  })
  .openapi({
    description: 'Method not allowed',
    example: {
      error: 'Method not allowed',
    },
  });

/**
 * Headers schemas
 */
export const RateLimitHeadersSchema = z.object({
  'X-RateLimit-Limit': z.string().openapi({ example: '30' }),
  'X-RateLimit-Remaining': z.string().openapi({ example: '0' }),
  'Retry-After': z.string().openapi({ example: '60' }),
  // Match NO_CACHE_HEADERS from app/lib/http/response.ts for error responses
  'Cache-Control': z
    .string()
    .openapi({
      example: 'no-store, no-cache, must-revalidate, max-age=0, s-maxage=0',
    }),
});

/**
 * Complete route definition for OpenAPI generation
 */
export const nonceRouteDefinition = {
  method: 'get',
  path: '/api/nonce',
  summary: 'Generate a nonce for SIWE authentication',
  description:
    'Generates a unique nonce value for Sign-In with Ethereum (SIWE) authentication flow. The nonce prevents replay attacks.',
  tags: ['Nonce', 'Authentication', 'SIWE'],
  responses: {
    200: {
      description: 'Successful response',
      headers: {
        // Runtime returns no-cache headers via noCacheJson(...)
        'Cache-Control': {
          schema: { type: 'string' },
          description: 'No-cache header for nonce responses',
          example: 'no-store, no-cache, must-revalidate, max-age=0, s-maxage=0',
        },
      },
      content: {
        'application/json': {
          schema: NonceSuccessResponseSchema,
        },
      },
    },
    429: {
      description: 'Rate limit exceeded',
      headers: RateLimitHeadersSchema,
      content: {
        'application/problem+json': {
          schema: NonceRateLimitResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/problem+json': {
          schema: NonceServerErrorResponseSchema,
        },
      },
    },
    501: {
      description: 'Not implemented',
      content: {
        'application/problem+json': {
          schema: NonceNotImplementedResponseSchema,
        },
      },
    },
    405: {
      description: 'Method not allowed',
      headers: {
        Allow: {
          schema: { type: 'string' },
          description: 'Comma-separated list of allowed methods',
          example: 'GET, OPTIONS',
        },
      },
      content: {
        'application/json': {
          schema: MethodNotAllowedResponseSchema,
        },
      },
    },
  },
};
