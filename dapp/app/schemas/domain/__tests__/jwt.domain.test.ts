// app/schemas/domain/__tests__/jwt.domain.test.ts
/// <reference types="vitest/globals" />

import { AccessTokenPayloadSchema, isAccessTokenPayload } from '@/app/schemas/domain/jwt.domain'

const nowSec = Math.floor(Date.now() / 1000)
const addr = '0x1234567890abcdef1234567890abcdef12345678' // lowercase
const nonceHex32 = '0123456789abcdef0123456789abcdef' // 32 hex chars
const uuid = '123e4567-e89b-12d3-a456-426614174000'

function basePayload() {
  return {
    iss: 'https://ritoswap.app',
    aud: ['ritoswap.app', 'api.ritoswap.app'],
    sub: addr,
    iat: nowSec - 10,
    exp: nowSec + 900,
    jti: uuid,
    kind: 'access' as const,
    auth: 'siwe' as const,
    scopes: ['gate:read'],
    tokenId: '42',
    siwe: {
      address: addr,
      domain: 'ritoswap.app',
      chainId: 1,
      nonce: nonceHex32,
      issuedAt: new Date().toISOString(),
    },
    siwe_hash: '0x' + 'a'.repeat(64),
  }
}

describe('AccessTokenPayloadSchema', () => {
  it('accepts a valid SIWE access token payload', () => {
    const payload = basePayload()
    const res = AccessTokenPayloadSchema.safeParse(payload)
    expect(res.success).toBe(true)
    expect(isAccessTokenPayload(payload)).toBe(true)
  })

  it('accepts a valid LEGACY access token payload (nonce="legacy")', () => {
    const payload = {
      ...basePayload(),
      auth: 'legacy' as const,
      siwe: {
        ...basePayload().siwe,
        nonce: 'legacy' as const,
        // issuedAt must be ISO string; in legacy we set it from timestamp upstream
        issuedAt: new Date().toISOString(),
      },
    }
    expect(AccessTokenPayloadSchema.safeParse(payload).success).toBe(true)
  })

  it('rejects when iss is not a URL', () => {
    const payload = { ...basePayload(), iss: 'ritoswap.app' as any }
    expect(AccessTokenPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects when aud is empty', () => {
    const payload = { ...basePayload(), aud: [] as any }
    expect(AccessTokenPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects when siwe_hash is not a 0x-prefixed 64-byte hex', () => {
    const payload = { ...basePayload(), siwe_hash: '0x' + 'a'.repeat(63) }
    expect(AccessTokenPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects when tokenId is non-numeric string', () => {
    const payload = { ...basePayload(), tokenId: 'forty-two' }
    expect(AccessTokenPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects when siwe.nonce is not hex or "legacy"', () => {
    const payload = { ...basePayload(), siwe: { ...basePayload().siwe, nonce: 'nope' } }
    expect(AccessTokenPayloadSchema.safeParse(payload).success).toBe(false)
  })
})
