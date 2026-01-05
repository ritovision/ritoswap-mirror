// app/lib/auth/nonSiweAuth.ts
import { NextRequest } from 'next/server'
import { verifyMessage } from 'viem'
import { getChainConfig } from '@config/chain'
import { publicEnv } from '@config/public.env'
import type {
  LegacyMessageParams,
  LegacyAuthResult
} from '@schemas/domain/legacy-auth.domain'

/**
 * Normalize a domain-ish string to "host[:port]" (lowercase).
 */
export function normalizeHost(input: string | null | undefined): string | null {
  if (!input) return null
  const raw = input.toString().trim()
  if (!raw) return null
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `http://${raw}`)
    return url.host.toLowerCase()
  } catch {
    return raw.replace(/\/+$/, '').toLowerCase()
  }
}

/**
 * Resolve the effective host of a request (honors x-forwarded-host).
 */
export function getRequestHost(req: NextRequest): string | null {
  const xfHost = req.headers.get('x-forwarded-host')
  const host = xfHost || req.headers.get('host')
  return normalizeHost(host)
}

/**
 * Allowed domains parsed from the validated public env.
 * Comma-delimited list; default is "localhost:3000".
 */
export function getAllowedDomains(): string[] {
  const env = publicEnv.NEXT_PUBLIC_DOMAIN || 'localhost:3000'
  return Array.from(
    new Set(
      env
        .split(',')
        .map(s => normalizeHost(s))
        .filter((s): s is string => !!s)
    )
  )
}

/**
 * Build the canonical legacy (non-SIWE) message the client must sign.
 * This binds the signature to the *actual* request host, path, method, chain, and timestamp.
 */
export function buildLegacyExpectedMessage(params: LegacyMessageParams): string {
  const { tokenId, reqHost, path, method, chainId, timestamp } = params
  return [
    `I own key #${tokenId}`,
    `Domain: ${reqHost}`,
    `Path: ${path}`,
    `Method: ${method}`,
    `ChainId: ${chainId}`,
    `Timestamp: ${timestamp}`
  ].join('\n')
}

// Legacy type exports for backward compatibility
export type LegacyAuthFailureCode =
  | 'INVALID_TIMESTAMP'
  | 'FUTURE_TIMESTAMP'
  | 'EXPIRED'
  | 'ALLOWLIST_REQUIRED'
  | 'HOST_NOT_ALLOWED'
  | 'CHAIN_CONFIG'
  | 'INVALID_SIGNATURE'

/**
 * Perform legacy (non-SIWE) authentication for a request:
 *  - Validates timestamp freshness (anti-replay)
 *  - Enforces domain allowlist (configurable: required vs optional)
 *  - Binds signature to host, path, method, chainId, and timestamp
 *  - Verifies signature using viem
 *
 * Timestamp tolerance:
 *  - For freshness checks we accept either seconds or milliseconds.
 *    If `timestamp < 1e12`, it is treated as seconds and converted to ms.
 *  - For signature verification we use the timestamp value *as received*,
 *    so the server builds the exact same message the client signed.
 */
export async function assertLegacyAuth(params: {
  request: NextRequest
  address: string
  signature: string
  tokenId: string
  timestamp: number
  /**
   * If true, env allowlist MUST be configured and host MUST be in it.
   * If false, allowlist is enforced only when configured (dev-friendly).
   */
  requireAllowlist?: boolean
  /**
   * Maximum allowed age for the timestamp (ms). Default: 5 minutes.
   */
  maxSkewMs?: number
  /**
   * Allowed positive drift for client clock vs server (ms). Default: 0.
   * (Some flows tolerate a small future skew; set e.g. 30000.)
   */
  futureLeewayMs?: number
}): Promise<LegacyAuthResult> {
  const {
    request,
    address,
    signature,
    tokenId,
    timestamp,
    requireAllowlist = false,
    maxSkewMs = 5 * 60 * 1000,
    futureLeewayMs = 0
  } = params

  // 1) Timestamp checks (accept seconds or milliseconds for freshness only)
  if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) {
    return {
      success: false,
      status: 400,
      code: 'INVALID_TIMESTAMP',
      message: 'Missing or invalid timestamp'
    }
  }

  // Heuristic: treat values < 1e12 as seconds since epoch
  const tsMs = timestamp < 1e12 ? Math.floor(timestamp * 1000) : Math.floor(timestamp)
  const now = Date.now()

  if (tsMs > now + futureLeewayMs) {
    return {
      success: false,
      status: 401,
      code: 'FUTURE_TIMESTAMP',
      message: 'Timestamp cannot be in the future'
    }
  }
  if (now - tsMs > maxSkewMs) {
    return {
      success: false,
      status: 401,
      code: 'EXPIRED',
      message: 'Signature expired'
    }
  }

  // 2) Allowlist & host
  const reqHost = getRequestHost(request)
  const allowed = getAllowedDomains()

  if (requireAllowlist) {
    if (allowed.length === 0) {
      return {
        success: false,
        status: 500,
        code: 'ALLOWLIST_REQUIRED',
        message: 'Domain allowlist not configured'
      }
    }
    if (!reqHost || !allowed.includes(reqHost)) {
      return {
        success: false,
        status: 401,
        code: 'HOST_NOT_ALLOWED',
        message: 'Request host not allowed'
      }
    }
  } else {
    if (allowed.length > 0 && (!reqHost || !allowed.includes(reqHost))) {
      return {
        success: false,
        status: 401,
        code: 'HOST_NOT_ALLOWED',
        message: 'Request host not allowed'
      }
    }
  }

  // 3) Chain binding (use new config shape)
  const { chainId: expectedChainId } = getChainConfig()
  if (typeof expectedChainId !== 'number') {
    return {
      success: false,
      status: 500,
      code: 'CHAIN_CONFIG',
      message: 'Server chain configuration error'
    }
  }

  // 4) Message + signature verification (domain/path/method bound)
  const expectedPath = request.nextUrl.pathname
  const expectedMethod = (request.method || 'POST').toUpperCase()

  // IMPORTANT: use the *original* timestamp value (seconds or ms) to match the signed message exactly.
  const messageParams: LegacyMessageParams = {
    tokenId,
    reqHost,
    path: expectedPath,
    method: expectedMethod,
    chainId: expectedChainId,
    timestamp
  }

  const expectedMessage = buildLegacyExpectedMessage(messageParams)

  try {
    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message: expectedMessage,
      signature: signature as `0x${string}`
    })
    if (!valid) {
      return {
        success: false,
        status: 401,
        code: 'INVALID_SIGNATURE',
        message: 'Invalid signature'
      }
    }
  } catch {
    return {
      success: false,
      status: 401,
      code: 'INVALID_SIGNATURE',
      message: 'Invalid signature'
    }
  }

  return {
    success: true,
    reqHost: (reqHost || '') as string,
    chainId: expectedChainId,
    expectedMessage
  }
}
