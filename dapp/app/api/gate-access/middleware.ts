// app/api/gate-access/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { publicEnv } from '@config/public.env'
import { serverConfig } from '@config/server.env'

/**
 * Check if SIWE is enabled - must match route.ts logic
 */
function isSiweEnabled(): boolean {
  return (
    publicEnv.NEXT_PUBLIC_ENABLE_STATE_WORKER &&
    !!serverConfig.stateService.url &&
    !!serverConfig.stateService.apiKey
  )
}

/**
 * Middleware to enforce domain consistency on POST /api/gate-access
 * when SIWE (Sign-In with Ethereum) is enabled.
 */
export async function middleware(request: NextRequest) {
  // Only run on POST requests to this route
  if (request.method === 'POST') {
    const siweEnabled = isSiweEnabled()

    if (siweEnabled) {
      // When SIWE is enabled, require NEXT_PUBLIC_DOMAIN to be set
      const allowedDomain = publicEnv.NEXT_PUBLIC_DOMAIN

      if (!allowedDomain) {
        console.error('[Middleware] NEXT_PUBLIC_DOMAIN must be configured when SIWE is enabled')
        return NextResponse.json(
          { error: 'Server configuration error' },
          { status: 500 }
        )
      }

      try {
        // Check if request has SIWE fields
        const body = await request.clone().json()

        // If SIWE is enabled, reject legacy auth attempts
        if (!body.message || !body.nonce) {
          console.error('[Middleware] SIWE is required but legacy auth attempted')
          return NextResponse.json(
            { error: 'SIWE authentication required' },
            { status: 401 }
          )
        }

        // Let the route handle full SIWE verification
      } catch (err) {
        // Let the API route handle malformed JSON
        console.error('[Middleware] Failed to parse request body:', err)
      }
    }
  }

  // Allow the request to continue
  return NextResponse.next()
}

// Export the config to specify which routes this middleware applies to
export const config = {
  matcher: '/api/gate-access',
}
