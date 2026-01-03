import { NextRequest } from 'next/server'
import { publicEnv, publicConfig } from '@config/public.env'
import { serverConfig } from '@config/server.env'
import { getStateClient, isStateServiceEnabled } from '@/app/lib/state/client'
import { createLogger } from '@logger'
import type { 
  RateLimitCheckResult, 
  RateLimiterType,
  RateLimiterConfig 
} from '@/app/schemas/domain/rate-limit.domain'

const logger = createLogger('rate-limit')

/**
 * Server-side toggle for rate-limiting.
 * Uses validated env from sources of truth.
 */
export const isRateLimitEnabled = (): boolean => {
  return (
    publicEnv.NEXT_PUBLIC_ENABLE_STATE_WORKER &&
    serverConfig.stateService.isActive &&
    isStateServiceEnabled()
  )
}

// Rate limiter configurations for documentation/reference
export const RATE_LIMITER_CONFIGS: Record<RateLimiterType, RateLimiterConfig> = {
  nonce: {
    limit: 30,
    window: '60s',
    prefix: 'rl:nonce:'
  },
  gateAccess: {
    limit: 60,
    window: '60s',
    prefix: 'rl:gate-access:'
  },
  formSubmissionGate: {
    limit: 10,
    window: '60s',
    prefix: 'rl:form-submission:'
  },
  tokenStatus: {
    limit: 60,
    window: '60s',
    prefix: 'rl:token-status:'
  },
  global: {
    limit: 200,
    window: '3600s',
    prefix: 'rl:global:'
  }
}

const RATE_LIMITER_WINDOW_SECONDS: Record<RateLimiterType, number> = {
  nonce: 60,
  gateAccess: 60,
  formSubmissionGate: 60,
  tokenStatus: 60,
  global: 3600,
}

/**
 * Extract client identifier (IP) with environment-aware security.
 */
export function getIdentifier(req: NextRequest): string {
  // Try common headers first
  const forwarded = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')

  if (forwarded) return forwarded.split(',')[0].trim()
  if (realIp) return realIp

  // For local dev, return consistent identifier
  if (publicConfig.isDevelopment) {
    return '127.0.0.1'
  }

  // Detect if we're running in production (node.env via public.env)
  const isProd = publicConfig.isProduction
  if (isProd) {
    const vercelForwarded = req.headers.get('x-forwarded-for')
    if (vercelForwarded) {
      return vercelForwarded.split(',')[0].trim()
    }
  }

  // Fallbacks for non-Vercel or unknown environments
  const ipUnknown = (req as unknown as { ip?: unknown }).ip
  if (typeof ipUnknown === 'string') return ipUnknown

  return `unknown-${Date.now()}-${Math.random()}`
}

/**
 * Main entry: checks per-route limiter, optional global limiter, then fetches stored nonce.
 * Now returns typed domain result.
 */
export async function checkRateLimitWithNonce(
  req: NextRequest,
  limiterType: RateLimiterType,
  includeGlobal = true
): Promise<RateLimitCheckResult> {
  if (!isRateLimitEnabled()) {
    return { success: true }
  }

  const identifier = getIdentifier(req)
  const limiterResult = await applyLimiter(limiterType, identifier)
  if (!limiterResult.success) {
    return limiterResult
  }

  if (includeGlobal && limiterType !== 'tokenStatus') {
    const globalResult = await applyLimiter('global', identifier)
    if (!globalResult.success) {
      return globalResult
    }
  }

  let nonce: string | undefined
  try {
    nonce = await getStateClient().getNonce(identifier) ?? undefined
  } catch (error) {
    logger.warn('nonce_lookup_failed', {
      identifier,
      error: (error as Error)?.message ?? 'unknown',
    })
  }

  return {
    success: true,
    limit: limiterResult.limit,
    remaining: limiterResult.remaining,
    reset: limiterResult.reset,
    nonce,
  }
}

/**
 * Get rate limiter configuration for a specific type
 */
export function getRateLimiterConfig(type: RateLimiterType): RateLimiterConfig {
  return RATE_LIMITER_CONFIGS[type]
}

async function applyLimiter(
  type: RateLimiterType,
  identifier: string,
): Promise<RateLimitCheckResult> {
  const config = RATE_LIMITER_CONFIGS[type]
  const windowSeconds = RATE_LIMITER_WINDOW_SECONDS[type]

  if (!config || !windowSeconds) {
    return { success: true }
  }

  try {
    return await getStateClient().checkRateLimit({
      limiter: type,
      identifier,
      limit: config.limit,
      windowSeconds,
    })
  } catch (error) {
    logger.error('rate_limit_service_error', {
      limiter: type,
      error: (error as Error)?.message ?? 'unknown',
    })
    return { success: true }
  }
}
