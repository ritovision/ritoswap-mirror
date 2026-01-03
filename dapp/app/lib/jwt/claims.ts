// app/lib/jwt/claims.ts
// Pure helpers to build typed JWT payloads from SIWE or Legacy auth.

import { keccak256 } from 'viem'
import { AccessTokenPayloadSchema, type AccessTokenPayload } from '@schemas/domain/jwt.domain'

export type BuildAccessClaimsInput = {
  auth: 'siwe' | 'legacy'
  siweParsed: {
    address: string
    domain: string
    chainId: number
    nonce: string // 'legacy' allowed at schema level
    issuedAt: string
    notBefore?: string
    expirationTime?: string
    resources?: string[]
  }
  originalSiweMessage: string             // SIWE text or legacy expected message
  issuer: string
  audiences: string[]
  accessTtlSec: number
  scopes?: string[]
  tokenId?: string
  nowSec?: number                         // override for testing
}

/**
 * Build a strict, Zod-validated access payload.
 * - Lowercases address
 * - Adds iat/exp/jti
 * - Hashes original message into siwe_hash for integrity
 */
export function buildAccessClaims(input: BuildAccessClaimsInput): AccessTokenPayload {
  const now = typeof input.nowSec === 'number' ? input.nowSec : Math.floor(Date.now() / 1000)
  const exp = now + input.accessTtlSec
  const jti = crypto.randomUUID()
  const addressLower = input.siweParsed.address.toLowerCase() as `0x${string}`

  const payload = {
    kind: 'access' as const,
    auth: input.auth,
    iss: input.issuer,
    aud: input.audiences,
    sub: addressLower,
    iat: now,
    exp,
    jti,
    scopes: input.scopes ?? [],
    tokenId: input.tokenId,
    siwe: {
      ...input.siweParsed,
      address: addressLower,
    },
    siwe_hash: keccak256(new TextEncoder().encode(input.originalSiweMessage)),
  }

  return AccessTokenPayloadSchema.parse(payload)
}

/**
 * Convenience: construct a SIWE-like projection from legacy inputs.
 */
export function legacyProjection(params: {
  address: `0x${string}`
  domain: string
  chainId: number
  issuedAtMs: number
}): BuildAccessClaimsInput['siweParsed'] {
  return {
    address: params.address.toLowerCase(),
    domain: params.domain,
    chainId: params.chainId,
    nonce: 'legacy',
    issuedAt: new Date(params.issuedAtMs).toISOString(),
  }
}
