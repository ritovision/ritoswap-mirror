// app/schemas/openapi/gate-access.openapi.ts
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { 
  GateAccessSiweRequestSchema,
  GateAccessLegacyRequestSchema,
  GateAccessSuccessResponseSchema,
} from '@/app/schemas/dto/gate-access.dto';
import { ProblemDetailsSchema } from '@/app/schemas/dto/common.dto';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

/**
 * Additional schema: minimal JWT request body
 * Used when the client authenticates with Authorization: Bearer <JWT>.
 * Body can be omitted entirely, but if provided it may include tokenId
 * so the server can enforce gate bindings when JWT lacks tokenId.
 */
export const GateAccessJwtRequestSchema = z.object({
  tokenId: z.union([
    z.string().regex(/^\d+$/, 'Token ID must be numeric'),
    z.number().int().nonnegative(),
  ]).optional(),
}).openapi({
  description: 'JWT-based request (used with Authorization: Bearer <JWT>)',
  example: { tokenId: '123' },
});

/**
 * Build OpenAPI-wrapped versions of the request schemas
 */
export const GateAccessSiweRequestOpenApi = GateAccessSiweRequestSchema.openapi({
  description: 'SIWE authentication request',
  example: {
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4',
    signature: '0x1234567890abcdef...',
    tokenId: '123',
    message:
      'localhost:3000 wants you to sign in with your Ethereum account:\n' +
      '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4\n\n' +
      'Sign in to access token gate with key #123\n\n' +
      'URI: http://localhost:3000\nVersion: 1\nChain ID: 1\nNonce: abcd1234\nIssued At: 2024-01-01T00:00:00.000Z',
    nonce: 'abcd1234',
  },
});

export const GateAccessLegacyRequestOpenApi = GateAccessLegacyRequestSchema.openapi({
  description: 'Legacy authentication request (non-SIWE)',
  example: {
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4',
    signature: '0x1234567890abcdef...',
    tokenId: 123,
    timestamp: 1704067200000,
  },
});

/**
 * Success response (now includes optional accessToken)
 */
export const GateAccessSuccessOpenApi = GateAccessSuccessResponseSchema.openapi({
  description: 'Successful gate access',
  example: {
    success: true,
    access: 'granted',
    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', // JWT string (present when a new token was minted)
    content: {
      welcomeText: 'Welcome, esteemed key holder!',
      textSubmissionAreaHtml: '<div class="submission-area">Submit your exclusive content</div>',
      audioData: {
        headline: 'Exclusive Audio',
        imageSrc: '/audio/exclusive-track.jpg',
        imageAlt: 'Exclusive audio content',
        description: 'Token holder exclusive audio content',
        title: 'Token Holder Audio',
        audioSrc: '/audio/exclusive.mp3',
      },
      styles: '.submission-area { padding: 20px; background: #f0f0f0; }',
      script: 'console.log("Gated content loaded");',
    },
  },
});

/**
 * Standard error responses
 */
export const GateAccessUnauthorizedResponse = ProblemDetailsSchema.openapi({
  description: 'Authentication failed',
  example: {
    type: 'https://ritoswap.com/errors/unauthorized',
    title: 'Authentication failed',
    status: 401,
    detail: 'The provided signature or credentials are invalid',
  },
});

export const GateAccessForbiddenResponse = ProblemDetailsSchema.openapi({
  description: 'Access forbidden',
  example: {
    type: 'https://ritoswap.com/errors/forbidden',
    title: 'You do not own this token',
    status: 403,
    detail: 'Token ownership verification failed or token has already been used',
  },
});

export const GateAccessNotFoundResponse = ProblemDetailsSchema.openapi({
  description: 'Token not found',
  example: {
    type: 'https://ritoswap.com/errors/not-found',
    title: 'Token not found in database',
    status: 404,
    detail: 'The specified token does not exist in our records',
  },
});

export const GateAccessRateLimitResponse = ProblemDetailsSchema.openapi({
  description: 'Rate limit exceeded',
  example: {
    type: 'https://ritoswap.com/errors/rate-limit',
    title: 'Too many requests',
    status: 429,
    detail: 'Rate limit exceeded for gate access',
    limit: 60,
    remaining: 0,
    retryAfter: 60,
  },
});

export const GateAccessServerErrorResponse = ProblemDetailsSchema.openapi({
  description: 'Internal server error',
  example: {
    type: 'https://ritoswap.com/errors/internal',
    title: 'Internal server error',
    status: 500,
    detail: 'An unexpected error occurred while processing your request',
  },
});

/**
 * Optional security scheme export (hook this up in your OpenAPI generator)
 * This declares the HTTP Bearer auth used for the JWT path.
 */
export const bearerAuthSecurityScheme = {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
} as const;

/**
 * Complete route definition for OpenAPI generation
 */
export const gateAccessRouteDefinition = {
  method: 'post' as const,
  path: '/api/gate-access',
  summary: 'Verify token ownership and access gated content',
  description: `Authenticates user ownership of an NFT token and provides access to gated content.

Supports three authentication flows:
1. **JWT (Bearer)** — Provide \`Authorization: Bearer <JWT>\`. Body may be omitted, or include { tokenId } for server-side binding.
2. **SIWE** — Provide address/signature + SIWE message + nonce in the body.
3. **Legacy** — Provide address/signature + timestamp in the body (when SIWE is disabled or legacy path is allowed).

The server verifies:
- Signature/JWT validity
- On-chain token ownership
- Token usage status in database
- Rate limits`,
  tags: ['Token Gate', 'Authentication'],
  // Attach bearerAuth as an allowed security mechanism, but keep a fallback
  // empty object so the operation remains usable with body-based auth flows.
  security: [{ bearerAuth: [] }, {}],
  parameters: [
    {
      name: 'Authorization',
      in: 'header',
      required: false,
      description: 'Bearer JWT for session-based access (optional if using SIWE/legacy body auth). Example: Bearer eyJhbGciOi...',
      schema: { type: 'string' },
      example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    },
  ],
  request: {
    // Body is optional because JWT-only requests may send no body
    body: {
      required: false,
      content: {
        'application/json': {
          // Use explicit oneOf to express the three request shapes
          schema: {
            oneOf: [
              GateAccessSiweRequestOpenApi,
              GateAccessLegacyRequestOpenApi,
              GateAccessJwtRequestSchema,
            ],
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Access granted',
      content: {
        'application/json': {
          schema: GateAccessSuccessOpenApi,
        },
      },
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ProblemDetailsSchema.openapi({
            example: {
              type: 'https://ritoswap.com/errors/bad-request',
              title: 'Invalid request',
              status: 400,
              detail: 'Request body validation failed or tokenId missing',
            },
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: GateAccessUnauthorizedResponse,
        },
      },
    },
    403: {
      description: 'Forbidden',
      content: {
        'application/json': {
          schema: GateAccessForbiddenResponse,
        },
      },
    },
    404: {
      description: 'Not found',
      content: {
        'application/json': {
          schema: GateAccessNotFoundResponse,
        },
      },
    },
    429: {
      description: 'Rate limited',
      headers: z.object({
        'X-RateLimit-Limit': z.string().openapi({ example: '60' }),
        'X-RateLimit-Remaining': z.string().openapi({ example: '0' }),
        'Retry-After': z.string().openapi({ example: '60' }),
      }),
      content: {
        'application/json': {
          schema: GateAccessRateLimitResponse,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: GateAccessServerErrorResponse,
        },
      },
    },
  },
};
