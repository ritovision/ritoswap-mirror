// app/lib/jwt/server.ts
// Server-only JWT signing & verification using `jose`.

import 'server-only'
import { SignJWT, jwtVerify, decodeProtectedHeader, importPKCS8, importSPKI } from 'jose'
import { jwtServerConfig } from '@config/jwt.server'
import { AccessTokenPayloadSchema, type AccessTokenPayload } from '@schemas/domain/jwt.domain'

type Verified<T> = { payload: T; header: ReturnType<typeof decodeProtectedHeader> }

/** ---------- Key management (cached) ---------- */
// Derive key types from jose helpers to avoid version-specific type exports
type JosePrivateKey = Awaited<ReturnType<typeof importPKCS8>>
type JosePublicKey  = Awaited<ReturnType<typeof importSPKI>>

let cachedPrivateKey: JosePrivateKey | Uint8Array | undefined
let cachedPublicKey: JosePublicKey  | Uint8Array | undefined

async function getPrivateKey(): Promise<JosePrivateKey | Uint8Array> {
  if (jwtServerConfig.alg === 'HS256') return jwtServerConfig.secret!
  if (cachedPrivateKey) return cachedPrivateKey
  cachedPrivateKey = await importPKCS8(jwtServerConfig.privateKeyPem!, jwtServerConfig.alg)
  return cachedPrivateKey
}

async function getPublicKey(): Promise<JosePublicKey | Uint8Array> {
  if (jwtServerConfig.alg === 'HS256') return jwtServerConfig.secret!
  if (cachedPublicKey) return cachedPublicKey
  cachedPublicKey = await importSPKI(jwtServerConfig.publicKeyPem!, jwtServerConfig.alg)
  return cachedPublicKey
}

/** ---------- Sign / Verify ---------- */

/**
 * Sign a validated AccessTokenPayload into a compact JWT.
 * We mirror the payload's claims in protected fields for strictness.
 */
export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: jwtServerConfig.alg })
    .setSubject(payload.sub)
    .setIssuer(jwtServerConfig.issuer)
    .setAudience(jwtServerConfig.audiences)
    .setIssuedAt(payload.iat)
    .setExpirationTime(payload.exp)
    .setJti(payload.jti)

  const key = await getPrivateKey()
  return jwt.sign(key)
}

/**
 * Verify a JWT and return a Zod-validated typed payload.
 * Enforces iss/aud/exp/nbf with configured clock tolerance.
 */
export async function verifyAccessToken(token: string): Promise<Verified<AccessTokenPayload>> {
  const key = await getPublicKey()
  const { payload, protectedHeader } = await jwtVerify(token, key, {
    issuer: jwtServerConfig.issuer,
    audience: jwtServerConfig.audiences,
    clockTolerance: jwtServerConfig.clockToleranceSec,
  })

  const typed = AccessTokenPayloadSchema.parse(payload)

  // Optional defense: ensure header alg matches expected
  if (protectedHeader.alg !== jwtServerConfig.alg) {
    throw new Error('JWT alg mismatch')
  }
  return { payload: typed, header: protectedHeader }
}

/** ---------- Utilities ---------- */

/** Extract Bearer token from Request headers. */
export function readBearerFromRequest(req: Request | { headers: Headers }): string | null {
  const headers = 'headers' in req ? req.headers : new Headers()
  const auth = headers.get('authorization') || headers.get('Authorization')
  if (!auth) return null
  if (!auth.startsWith('Bearer ')) return null
  return auth.slice(7)
}

/** Parse Cookie header into a plain object. */
function parseCookieHeader(headerVal: string | null): Record<string, string> {
  if (!headerVal) return {}
  const out: Record<string, string> = {}
  headerVal.split(';').forEach((kv) => {
    const idx = kv.indexOf('=')
    if (idx > -1) {
      const k = kv.slice(0, idx).trim()
      const v = kv.slice(idx + 1).trim()
      out[k] = decodeURIComponent(v)
    }
  })
  return out
}

/**
 * Robust JWT retrieval:
 * 1) Authorization: Bearer
 * 2) body.jwt or body.data.jwt (if body provided)
 * 3) Cookie: access_token or jwt
 * 4) ?jwt= query param
 */
export function readJwtFromAny(req: Request, body?: unknown): string | null {
  const headerJwt = readBearerFromRequest(req)
  if (headerJwt) return headerJwt

  let bodyJwt: string | null = null
  if (typeof body === 'object' && body !== null) {
    const maybeJwt = (body as { jwt?: unknown }).jwt
    if (typeof maybeJwt === 'string') {
      bodyJwt = maybeJwt
    } else {
      const maybeData = (body as { data?: unknown }).data
      const nestedJwt = (maybeData as { jwt?: unknown } | undefined)?.jwt
      if (typeof nestedJwt === 'string') bodyJwt = nestedJwt
    }
  }
  if (bodyJwt) return bodyJwt

  const cookies = parseCookieHeader(req.headers.get('cookie') || req.headers.get('Cookie'))
  if (typeof cookies['access_token'] === 'string' && cookies['access_token'].length > 0) {
    return cookies['access_token']
  }
  if (typeof cookies['jwt'] === 'string' && cookies['jwt'].length > 0) {
    return cookies['jwt']
  }

  try {
    const url = new URL(req.url)
    const qp = url.searchParams.get('jwt')
    if (typeof qp === 'string' && qp.length > 0) return qp
  } catch {
    /* ignore */
  }

  return null
}

/** Simple scope check utility */
export function hasAllScopes(payload: AccessTokenPayload, required: string[]): boolean {
  if (!required.length) return true
  const set = new Set(payload.scopes)
  return required.every(s => set.has(s))
}
