// app/api/nonce/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { generateNonce, isSiweEnabled } from '@lib/siwe/siwe.server'
import { checkRateLimitWithNonce, getIdentifier } from '@lib/rateLimit/rateLimit.server'
import { createLogger } from '@logger'
import { withCors, handleCors } from '@lib/http/cors'
import {
  noCacheJson,
  problemResponse,
  rateLimitResponse,
} from '@lib/http/response'
import {
  NonceResponseSchema,
  type NonceResponseDTO,
} from '@schemas/dto/nonce.dto'
import type { NonceGenerationParams } from '@schemas/domain/nonce.domain'

const logger = createLogger('nonce-api')

export async function GET(request: NextRequest) {
  // Check if SIWE is enabled
  if (!isSiweEnabled()) {
    const res = problemResponse(
      501,
      'SIWE not enabled',
      'SIWE authentication is not configured on this server'
    )
    return withCors(res, request)
  }

  // Check rate limit
  const rateLimitResult = await checkRateLimitWithNonce(request, 'nonce')

  if (!rateLimitResult.success) {
    logger.warn('Rate limit exceeded for nonce generation')
    const res = rateLimitResponse(rateLimitResult, 'Rate limit exceeded for nonce generation')
    return withCors(res, request)
  }

  try {
    const identifier = getIdentifier(request)

    // Check if we already have a nonce from the rate limit check
    let nonce = rateLimitResult.nonce

    // Generate new nonce if we don't have one
    if (!nonce) {
      // Create domain object for nonce generation
      const nonceParams: NonceGenerationParams = {
        identifier,
        ttlSeconds: 300, // 5 minutes
      }

      const result = await generateNonce(nonceParams)
      nonce = result.value
    }

    logger.info('Nonce generated', { identifier })

    // Validate and return response
    const response: NonceResponseDTO = NonceResponseSchema.parse({ nonce })
    const res = noCacheJson(response)
    return withCors(res, request)
  } catch (error) {
    logger.error('Error generating nonce', {
      error: error instanceof Error ? error.message : String(error),
    })

    const res = problemResponse(
      500,
      'Failed to generate nonce',
      'An unexpected error occurred while generating the nonce'
    )
    return withCors(res, request)
  }
}

// ----- 405 helpers -----
function methodNotAllowed(request: NextRequest): NextResponse {
  const res = NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
  // Advertise allowed methods per RFC 9110
  res.headers.set('Allow', 'GET, OPTIONS')
  return withCors(res, request)
}

export async function POST(request: NextRequest) {
  return methodNotAllowed(request)
}

export async function PUT(request: NextRequest) {
  return methodNotAllowed(request)
}

export async function DELETE(request: NextRequest) {
  return methodNotAllowed(request)
}

export async function PATCH(request: NextRequest) {
  return methodNotAllowed(request)
}

// Preflight support with CORS headers
export function OPTIONS(request: NextRequest) {
  return handleCors(request) ?? new NextResponse(null, { status: 204 })
}
