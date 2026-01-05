// app/config/jwt.server.ts
// Centralized, server-only JWT configuration ready for signing/verifying.
// Keep secrets here and import ONLY from server code.

import 'server-only'
import { serverEnv } from './server.env'

const audiences = serverEnv.JWT_AUD.split(',').map(s => s.trim()).filter(Boolean)

// Expose typed, frozen config for server-side libraries (e.g., lib/jwt/server.ts)
export const jwtServerConfig = Object.freeze({
  alg: serverEnv.JWT_ALG,                         // 'HS256' | 'EdDSA' | 'ES256'
  issuer: serverEnv.JWT_ISS,
  audiences,
  accessTtlSec: serverEnv.JWT_ACCESS_TTL,
  clockToleranceSec: serverEnv.JWT_CLOCK_TOLERANCE,

  // Signing material (one of the below will be defined depending on alg)
  // HS256
  secret: serverEnv.JWT_ALG === 'HS256'
    ? new TextEncoder().encode(serverEnv.JWT_SECRET!)
    : undefined,

  // EdDSA / ES256 (PEM strings; your jose layer will import them as KeyLike)
  privateKeyPem: serverEnv.JWT_ALG !== 'HS256' ? serverEnv.JWT_PRIVATE_KEY! : undefined,
  publicKeyPem: serverEnv.JWT_ALG !== 'HS256' ? serverEnv.JWT_PUBLIC_KEY! : undefined,
} as const)

export type JwtServerConfig = typeof jwtServerConfig
