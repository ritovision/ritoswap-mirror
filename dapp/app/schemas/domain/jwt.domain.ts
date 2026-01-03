// app/schemas/domain/jwt.domain.ts
// Shared (isomorphic) Zod schemas for the access JWT payload.
// Safe to import on both client and server (no secrets here).

import { z } from 'zod'
import { AddressSchema, NonceSchema } from '@/app/config/security.public'

/** Unix seconds (JWT standard) */
export const Unix = z.number().int().nonnegative()
/** EVM chain id */
export const ChainId = z.number().int().positive()

/**
 * Subset of SIWE fields we preserve inside the JWT.
 * For legacy auth we still fill this shape (nonce='legacy', issuedAt=timestamp ISO).
 *
 * Note: In Zod v4, use top-level ISO helpers:
 *   - z.iso.datetime() for ISO 8601 datetimes (no offset by default; "Z" allowed)
 */
export const SiweCoreSchema = z.object({
  address: AddressSchema,              // normalized to lowercase
  domain: z.string().min(1),
  chainId: ChainId,
  nonce: NonceSchema.or(z.literal('legacy')),
  issuedAt: z.iso.datetime(),          // ISO string (UTC "Z" by default)
  notBefore: z.iso.datetime().optional(),
  expirationTime: z.iso.datetime().optional(),
  resources: z.array(z.string()).optional(),
})

/** Standard JWT claims we care about */
export const StandardClaimsSchema = z.object({
  iss: z.url(),
  aud: z.array(z.string().min(1)).min(1),
  sub: AddressSchema,                  // wallet address (lowercased)
  iat: Unix,
  exp: Unix,
  nbf: Unix.optional(),
  jti: z.uuid(),
})

/**
 * Access token payload used by the app.
 * - `kind`: token category (stays 'access')
 * - `auth`: which auth produced it (siwe | legacy)
 * - `tokenId`: optional binding to a particular gate token
 * - `siwe_hash`: keccak256 of the original message (SIWE text or legacy expected message)
 */
export const AccessTokenPayloadSchema = StandardClaimsSchema.extend({
  kind: z.literal('access'),
  auth: z.enum(['siwe', 'legacy']),
  scopes: z.array(z.string().min(1)).default([]),
  tokenId: z.string().regex(/^\d+$/).optional(),
  siwe: SiweCoreSchema,
  siwe_hash: z.string().length(66).regex(/^0x[0-9a-fA-F]{64}$/),
})

export type AccessTokenPayload = z.infer<typeof AccessTokenPayloadSchema>

/** Narrow type guard for decoded payloads */
export function isAccessTokenPayload(data: unknown): data is AccessTokenPayload {
  return AccessTokenPayloadSchema.safeParse(data).success
}
