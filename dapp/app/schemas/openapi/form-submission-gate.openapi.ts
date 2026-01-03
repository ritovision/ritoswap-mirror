// app/schemas/openapi/form-submission-gate.openapi.ts
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { 
  FormSubmissionRequestSchema,
  FormSubmissionSuccessResponseSchema
} from '@/app/schemas/dto/form-submission-gate.dto';
import { ProblemDetailsSchema } from '@/app/schemas/dto/common.dto';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

/**
 * Request body with OpenAPI metadata
 */
export const FormSubmissionRequestBodySchema = FormSubmissionRequestSchema.openapi({
  description: 'Form submission with token ownership verification',
  example: {
    tokenId: 42,
    message: "Hello from my gated form!",
    signature: "0x...",
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    timestamp: 1712345678901
  }
});

/**
 * Response schemas with OpenAPI metadata
 */

// 200 Success
export const FormSubmissionSuccessSchema = FormSubmissionSuccessResponseSchema.openapi({
  description: 'Submission accepted and token marked as used',
  example: {
    success: true,
    message: 'Access granted'
  }
});

// 400 Bad Request
export const FormSubmissionBadRequestSchema = ProblemDetailsSchema.openapi({
  description: 'Invalid input payload',
  example: {
    type: 'https://ritoswap.com/errors/invalid-input',
    title: 'Invalid input',
    status: 400,
    detail: 'Missing tokenId'
  }
});

// 401 Unauthorized
export const FormSubmissionUnauthorizedSchema = ProblemDetailsSchema.openapi({
  description: 'Authentication failed',
  example: {
    type: 'https://ritoswap.com/errors/authentication-failed',
    title: 'Authentication failed',
    status: 401,
    detail: 'Invalid signature'
  }
});

// 403 Forbidden
export const FormSubmissionForbiddenSchema = ProblemDetailsSchema.openapi({
  description: 'Not token owner or token already used',
  example: {
    type: 'https://ritoswap.com/errors/forbidden',
    title: 'Forbidden',
    status: 403,
    detail: 'You do not own this token'
  }
});

// 429 Rate Limited
export const FormSubmissionRateLimitSchema = ProblemDetailsSchema.openapi({
  description: 'Rate limit exceeded',
  example: {
    type: 'https://ritoswap.com/errors/rate-limit',
    title: 'Too many requests',
    status: 429,
    detail: 'Rate limit exceeded for form-submission-gate',
    limit: 10,
    remaining: 0,
    retryAfter: 60
  }
});

// 500 Server Error
export const FormSubmissionServerErrorSchema = ProblemDetailsSchema.openapi({
  description: 'Server error (DB/email/chain errors)',
  example: {
    type: 'https://ritoswap.com/errors/internal-error',
    title: 'Internal server error',
    status: 500,
    detail: 'Failed to verify token ownership'
  }
});

// 405 Method Not Allowed
export const FormSubmissionMethodNotAllowedSchema = z.object({
  error: z.string(),
}).openapi({
  description: 'Method not allowed',
  example: {
    error: 'Method not allowed'
  }
});

/**
 * Headers schemas
 */
export const FormSubmissionRateLimitHeadersSchema = z.object({
  'X-RateLimit-Limit': z.string().openapi({ example: '10' }),
  'X-RateLimit-Remaining': z.string().openapi({ example: '0' }),
  'Retry-After': z.string().openapi({ example: '60' }),
});

/**
 * Complete route definition for OpenAPI generation
 */
export const formSubmissionGateRouteDefinition = {
  method: 'post',
  path: '/api/form-submission-gate',
  summary: 'Submit a gated form (legacy signature auth)',
  description: `Accepts a message submission from a wallet address that owns the provided tokenId.
Uses legacy non-SIWE signature binding (domain/path/method/chain/timestamp) and marks the token as used.
In production, an email is dispatched (Brevo or Cloudflare Worker).`,
  tags: ['Form Submission Gate', 'NFT', 'Authentication'],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: FormSubmissionRequestBodySchema
      }
    }
  },
  responses: {
    200: {
      description: 'Submission accepted and token marked as used',
      content: {
        'application/json': {
          schema: FormSubmissionSuccessSchema
        }
      }
    },
    400: {
      description: 'Invalid input payload',
      content: {
        'application/problem+json': {
          schema: FormSubmissionBadRequestSchema
        }
      }
    },
    401: {
      description: 'Authentication failed',
      content: {
        'application/problem+json': {
          schema: FormSubmissionUnauthorizedSchema
        }
      }
    },
    403: {
      description: 'Not token owner or token already used',
      content: {
        'application/problem+json': {
          schema: FormSubmissionForbiddenSchema
        }
      }
    },
    429: {
      description: 'Rate limit exceeded',
      headers: FormSubmissionRateLimitHeadersSchema,
      content: {
        'application/problem+json': {
          schema: FormSubmissionRateLimitSchema
        }
      }
    },
    500: {
      description: 'Server error (DB/email/chain errors)',
      content: {
        'application/problem+json': {
          schema: FormSubmissionServerErrorSchema
        }
      }
    },
    405: {
      description: 'Method not allowed',
      content: {
        'application/json': {
          schema: FormSubmissionMethodNotAllowedSchema
        }
      }
    }
  },
  security: []
};
