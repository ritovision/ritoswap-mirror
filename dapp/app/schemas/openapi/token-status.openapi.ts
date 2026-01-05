// app/schemas/openapi/token-status.openapi.ts
import { z } from '@/app/schemas/zod-openapi';
import {
  InvalidTokenIdErrorSchema,
} from '@/app/schemas/dto/token-status.dto';
import { ProblemDetailsSchema } from '@/app/schemas/dto/common.dto';

/**
 * Path parameter schema
 * (document tokenId as a string of digits to match runtime)
 */
export const TokenIdParamSchema = z.object({
  tokenId: z
    .string()
    .regex(/^[0-9]+$/, 'Token ID must be a non-negative integer')
    .openapi({
      description: 'The NFT token ID to check',
      example: '123',
      param: {
        name: 'tokenId',
        in: 'path',
      },
    }),
});

/**
 * OpenAPI-compatible version of TokenStatusResponse with proper nullable fields
 */
export const TokenStatusResponseOpenAPISchema = z.object({
  count: z.number().int().min(0).max(1).openapi({
    description: 'Number of tokens found (0 or 1)',
    example: 1,
  }),
  exists: z.boolean().openapi({
    description: 'Whether the token exists on-chain',
    example: true,
  }),
  used: z.boolean().openapi({
    description: 'Whether the token has been used for gated access',
    example: false,
  }),
  usedBy: z.union([z.string(), z.null()]).openapi({
    description: 'Address that used the token (if used)',
    example: null,
  }),
  usedAt: z.union([z.string().datetime(), z.null()]).openapi({
    description: 'ISO timestamp when token was used (if used)',
    example: null,
  }),
}).openapi('TokenStatusResponse');

/**
 * Define all possible responses for the token-status endpoint
 */

// 200 Success - Token exists and has been used
export const TokenStatusExistsUsedResponseSchema = TokenStatusResponseOpenAPISchema.openapi({
  description: 'Token exists and has been used',
  example: {
    count: 1,
    exists: true,
    used: true,
    usedBy: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7',
    usedAt: '2025-01-15T10:30:00.000Z',
  },
});

// 200 Success - Token exists but not used
export const TokenStatusExistsUnusedResponseSchema = TokenStatusResponseOpenAPISchema.openapi({
  description: 'Token exists but has not been used',
  example: {
    count: 1,
    exists: true,
    used: false,
    usedBy: null,
    usedAt: null,
  },
});

// 200 Success - Token does not exist
export const TokenStatusNotExistsResponseSchema = TokenStatusResponseOpenAPISchema.openapi({
  description: 'Token does not exist on-chain',
  example: {
    count: 0,
    exists: false,
    used: false,
    usedBy: null,
    usedAt: null,
  },
});

// 400 Bad Request - Invalid token ID
export const TokenStatusBadRequestResponseSchema = InvalidTokenIdErrorSchema.openapi({
  description: 'Invalid token ID provided',
  example: {
    type: 'https://ritoswap.com/errors/invalid-token-id',
    title: 'Invalid token ID',
    status: 400,
    detail: 'Token ID must be a non-negative integer',
  },
});

// 429 Rate Limited
export const TokenStatusRateLimitResponseSchema = ProblemDetailsSchema.openapi({
  description: 'Rate limit exceeded',
  example: {
    type: 'https://ritoswap.com/errors/too-many-requests',
    title: 'Too many requests',
    status: 429,
    detail: 'Rate limit exceeded for token-status',
    limit: 60,
    remaining: 0,
    retryAfter: 60,
  },
});

// 500 Server Error
export const TokenStatusServerErrorResponseSchema = ProblemDetailsSchema.openapi({
  description: 'Internal server error',
  example: {
    type: 'https://ritoswap.com/errors/failed-to-check-token-status',
    title: 'Failed to check token status',
    status: 500,
    detail: 'An unexpected error occurred while checking token status',
  },
});

// 405 Method Not Allowed
export const TokenStatusMethodNotAllowedSchema = z
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
export const TokenStatusRateLimitHeadersSchema = z.object({
  'X-RateLimit-Limit': z.string().openapi({ example: '60' }),
  'X-RateLimit-Remaining': z.string().openapi({ example: '0' }),
  'Retry-After': z.string().openapi({ example: '60' }),
  // Match NO_CACHE_HEADERS from response.ts for error responses
  'Cache-Control': z
    .string()
    .openapi({ example: 'no-store, no-cache, must-revalidate, max-age=0, s-maxage=0' }),
});

/**
 * Complete route definition for OpenAPI generation
 * Using raw JSON Schema to ensure proper nullable field handling for Postman
 */
export const tokenStatusRouteDefinition = {
  method: 'get',
  path: '/api/token-status/{tokenId}',
  summary: 'Get token status and usage information',
  description:
    'Checks if a token exists on-chain and whether it has been used for gated access. This endpoint is optimized for polling with light caching.',
  tags: ['Token Status', 'NFT'],
  parameters: [
    {
      name: 'tokenId',
      in: 'path',
      required: true,
      description: 'The NFT token ID to check',
      schema: {
        type: 'string',
        pattern: '^[0-9]+$',
        example: '123',
      },
    },
  ],
  responses: {
    200: {
      description: 'Token status retrieved successfully',
      headers: {
        'Cache-Control': {
          schema: { type: 'string' },
          description: 'Cache control header for successful responses',
        },
      },
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['count', 'exists', 'used', 'usedBy', 'usedAt'],
            properties: {
              count: {
                type: 'integer',
                minimum: 0,
                maximum: 1,
                description: 'Number of tokens found (0 or 1)',
              },
              exists: {
                type: 'boolean',
                description: 'Whether the token exists on-chain',
              },
              used: {
                type: 'boolean',
                description: 'Whether the token has been used for gated access',
              },
              usedBy: {
                oneOf: [
                  { type: 'string' },
                  { type: 'null' }
                ],
                description: 'Address that used the token (if used)',
              },
              usedAt: {
                oneOf: [
                  { type: 'string', format: 'date-time' },
                  { type: 'null' }
                ],
                description: 'ISO timestamp when token was used (if used)',
              },
            },
          },
          examples: {
            'exists-used': {
              summary: 'Token exists and has been used',
              value: {
                count: 1,
                exists: true,
                used: true,
                usedBy: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7',
                usedAt: '2025-01-15T10:30:00.000Z',
              },
            },
            'exists-unused': {
              summary: 'Token exists but not used',
              value: {
                count: 1,
                exists: true,
                used: false,
                usedBy: null,
                usedAt: null,
              },
            },
            'not-exists': {
              summary: 'Token does not exist',
              value: {
                count: 0,
                exists: false,
                used: false,
                usedBy: null,
                usedAt: null,
              },
            },
          },
        },
      },
    },
    400: {
      description: 'Invalid token ID provided',
      content: {
        'application/problem+json': {
          schema: TokenStatusBadRequestResponseSchema,
        },
      },
    },
    429: {
      description: 'Rate limit exceeded',
      headers: TokenStatusRateLimitHeadersSchema,
      content: {
        'application/problem+json': {
          schema: TokenStatusRateLimitResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/problem+json': {
          schema: TokenStatusServerErrorResponseSchema,
        },
      },
    },
    405: {
      description: 'Method not allowed',
      content: {
        'application/json': {
          schema: TokenStatusMethodNotAllowedSchema,
        },
      },
    },
  },
  security: [],
};