// app/lib/siwe/siwe.server.ts
import { SiweMessage } from 'siwe'
import { publicEnv } from '@/app/config/public.env'
import { serverConfig } from '@config/server.env'
import type {
  NonceGenerationParams,
  NonceGenerationResult,
  NonceVerificationParams,
  NonceVerificationResult,
} from '@/app/schemas/domain/nonce.domain'
import type {
  ParsedSiweMessage,
  SiweVerificationParams,
  SiweVerificationResult,
} from '@/app/schemas/domain/siwe.domain'
import { randomBytes } from 'node:crypto'
import { NONCE_BYTES, NONCE_ENCODING } from '@/app/config/security.public'
import { getStateClient, isStateServiceEnabled } from '@/app/lib/state/client'

/**
 * Server-side toggle for SIWE/Durable Object storage (validated env).
 * Returns true only when the flag is on AND the worker creds exist.
 */
export const isSiweEnabled = (): boolean => {
  return (
    publicEnv.NEXT_PUBLIC_ENABLE_STATE_WORKER &&
    serverConfig.stateService.isActive &&
    isStateServiceEnabled()
  )
}

/**
 * Get domain server-side (validated public env first, then request headers).
 */
export const getDomain = (requestHeaders?: Headers): string => {
  const configured = (publicEnv.NEXT_PUBLIC_DOMAIN || 'localhost:3000')
    .split(',')[0]
    .trim()
    .replace(/^https?:\/\//, '')
  if (configured) return configured
  if (requestHeaders) {
    const host = requestHeaders.get('host')
    if (host) return host
  }
  return 'localhost:3000'
}

/**
 * Generate nonce and persist it via the state worker.
 */
export async function generateNonce(
  params: NonceGenerationParams
): Promise<NonceGenerationResult> {
  const nonce = generateRandomNonce()
  const ttl = params.ttlSeconds ?? 300 // Default 5 minutes
  const expiresAt = new Date(Date.now() + ttl * 1000)

  if (isSiweEnabled()) {
    await getStateClient().storeNonce(params.identifier, nonce, ttl)
  }

  return {
    value: nonce,
    expiresAt,
    identifier: params.identifier,
  }
}

/**
 * Verify and consume nonce via the state worker.
 */
export async function verifyNonce(
  params: NonceVerificationParams
): Promise<NonceVerificationResult> {
  if (!isSiweEnabled()) {
    return { isValid: true }
  }

  const storedNonce = await getStateClient().consumeNonce(params.identifier)

  if (storedNonce === params.nonce) {
    return { isValid: true }
  }

  if (!storedNonce) {
    return { isValid: false, reason: 'not_found' }
  }

  return { isValid: false, reason: 'mismatch' }
}

/** @deprecated Use verifyNonce with object parameter */
export async function verifyNonceLegacy(
  identifier: string,
  nonce: string
): Promise<boolean> {
  const result = await verifyNonce({ identifier, nonce })
  return result.isValid
}

/** Crypto-strong nonce: NONCE_BYTES + NONCE_ENCODING from the shared config */
function generateRandomNonce(): string {
  return randomBytes(NONCE_BYTES).toString(NONCE_ENCODING)
}

/**
 * Verify SIWE message using the official SIWE library.
 * - Verifies signature + spec invariants (domain, nonce, time)
 * - Confirms address matches the expected address
 * - Returns parsed fields for downstream policy checks (allowlist, etc.)
 */
export async function verifySiweMessage(
  params: SiweVerificationParams
): Promise<SiweVerificationResult> {
  try {
    const msg = new SiweMessage(params.message)

    // Spec-level verification (domain, nonce, time, signature)
    const expectedDomain = getDomain(params.requestHeaders)
    const { success } = await msg.verify({
      signature: params.signature,
      domain: expectedDomain,
      nonce: params.nonce,
      time: new Date().toISOString(),
    })
    if (!success) {
      return { success: false, error: 'invalid_signature' }
    }

    // Address match (policy)
    if (msg.address.toLowerCase() !== params.address.toLowerCase()) {
      return { success: false, error: 'address_mismatch' }
    }

    // Optional: we keep viem.verifyMessage in the route for belt-and-suspenders

    const parsed: ParsedSiweMessage = {
      domain: msg.domain,
      address: msg.address,
      statement: msg.statement || '',
      uri: msg.uri || '',
      version: String(msg.version ?? '1'),
      chainId: Number(msg.chainId ?? 1),
      nonce: msg.nonce,
      issuedAt: msg.issuedAt ?? new Date().toISOString(),
      expirationTime: msg.expirationTime,
      notBefore: msg.notBefore,
    }

    return { success: true, parsed }
  } catch (error) {
    console.error('SIWE verification error:', error)
    return { success: false, error: 'verification_failed' }
  }
}
