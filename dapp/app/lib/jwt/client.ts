// app/lib/jwt/client.ts
// Client-side helpers: localStorage management and safe decode (no verification).

import { decodeJwt } from 'jose'
import { AccessTokenPayloadSchema, type AccessTokenPayload } from '@schemas/domain/jwt.domain'

const STORAGE_KEY = 'access_token'

function inBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

/** Store / read / clear */
export function setStoredToken(token: string) {
  if (!inBrowser()) return
  localStorage.setItem(STORAGE_KEY, token)
}

export function getStoredToken(): string | null {
  if (!inBrowser()) return null
  return localStorage.getItem(STORAGE_KEY)
}

export function clearStoredToken() {
  if (!inBrowser()) return
  localStorage.removeItem(STORAGE_KEY)
}

/** Decode + Zod-validate. Returns null if invalid. */
export function decodeAccessToken(token: string): AccessTokenPayload | null {
  try {
    const payload = decodeJwt(token)
    return AccessTokenPayloadSchema.parse(payload)
  } catch {
    return null
  }
}

/** Expiry helpers */
export function isExpired(token: string): boolean {
  const p = decodeAccessToken(token)
  if (!p) return true
  const now = Math.floor(Date.now() / 1000)
  return p.exp <= now
}

export function secondsUntilExpiry(token: string): number | null {
  const p = decodeAccessToken(token)
  if (!p) return null
  const now = Math.floor(Date.now() / 1000)
  return Math.max(0, p.exp - now)
}

/** Convenience accessors */
export function getSubjectAddress(token: string): `0x${string}` | null {
  const p = decodeAccessToken(token)
  return p?.sub ?? null
}

export function hasScopes(token: string, scopes: string[]): boolean {
  const p = decodeAccessToken(token)
  if (!p) return false
  if (!scopes.length) return true
  const set = new Set(p.scopes)
  return scopes.every(s => set.has(s))
}
