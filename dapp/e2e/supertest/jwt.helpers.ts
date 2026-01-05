// FILE: c:\Users\Mattj\techstuff\ritoswap-clean\ritoswap1\dapp\e2e\supertest\jwt.helpers.ts
import request from 'supertest'
import type { Response as SupertestResponse } from 'supertest'

/**
 * JWT Test Helpers for Supertest
 * Utilities for testing JWT authentication flows
 */

/**
 * Parse JWT without verification (for testing purposes only)
 * Returns the decoded payload without validating signature
 */
export function parseJwtPayload(token: string): any {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format')
    }
    
    // Decode the payload (base64url)
    const payload = parts[1]
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8')
    return JSON.parse(decoded)
  } catch (error) {
    console.error('Failed to parse JWT:', error)
    return null
  }
}

/**
 * Extract JWT from response
 * Looks for accessToken in response body
 */
export function extractJwtFromResponse(response: SupertestResponse): string | null {
  if (response.body?.accessToken) {
    return response.body.accessToken
  }
  return null
}

/**
 * JWT validation assertions
 */
export const jwtAssertions = {
  /**
   * Assert that response contains a valid JWT
   */
  hasValidJwt(response: SupertestResponse) {
    const jwt = extractJwtFromResponse(response)
    expect(jwt).toBeTruthy()
    expect(typeof jwt).toBe('string')
    
    const payload = parseJwtPayload(jwt!)
    expect(payload).toBeTruthy()
    
    return { jwt, payload }
  },

  /**
   * Assert JWT payload contains expected fields
   */
  hasExpectedPayload(payload: any, expectedFields: {
    sub?: string
    tokenId?: string
    auth?: 'siwe' | 'legacy'
    kind?: string
    scopes?: string[]
  }) {
    if (expectedFields.sub) {
      expect(payload.sub?.toLowerCase()).toBe(expectedFields.sub.toLowerCase())
    }
    if (expectedFields.tokenId) {
      expect(payload.tokenId).toBe(expectedFields.tokenId)
    }
    if (expectedFields.auth) {
      expect(payload.auth).toBe(expectedFields.auth)
    }
    if (expectedFields.kind) {
      expect(payload.kind).toBe(expectedFields.kind)
    }
    if (expectedFields.scopes) {
      expect(payload.scopes).toEqual(expect.arrayContaining(expectedFields.scopes))
    }
  },

  /**
   * Assert JWT has valid timestamps
   */
  hasValidTimestamps(payload: any) {
    const now = Math.floor(Date.now() / 1000)
    
    // Check issued at (iat)
    expect(payload.iat).toBeDefined()
    expect(typeof payload.iat).toBe('number')
    expect(payload.iat).toBeLessThanOrEqual(now + 60) // Allow 1 minute clock skew
    expect(payload.iat).toBeGreaterThan(now - 300) // Should be recent (within 5 minutes)
    
    // Check expiration (exp)
    expect(payload.exp).toBeDefined()
    expect(typeof payload.exp).toBe('number')
    expect(payload.exp).toBeGreaterThan(now) // Should not be expired
    expect(payload.exp).toBeGreaterThan(payload.iat) // Exp should be after iat
    
    // Check not before (nbf) if present
    if (payload.nbf !== undefined) {
      expect(typeof payload.nbf).toBe('number')
      expect(payload.nbf).toBeLessThanOrEqual(now + 60) // Should be valid now (with clock skew)
    }
  },

  /**
   * Assert JWT contains SIWE projection
   */
  hasSiweProjection(payload: any, expected?: {
    address?: string
    domain?: string
    chainId?: number
    nonce?: string
  }) {
    expect(payload.siwe).toBeDefined()
    expect(typeof payload.siwe).toBe('object')
    
    if (expected?.address) {
      expect(payload.siwe.address?.toLowerCase()).toBe(expected.address.toLowerCase())
    }
    if (expected?.domain) {
      expect(payload.siwe.domain).toBe(expected.domain)
    }
    if (expected?.chainId) {
      expect(payload.siwe.chainId).toBe(expected.chainId)
    }
    if (expected?.nonce) {
      expect(payload.siwe.nonce).toBe(expected.nonce)
    }
    
    // Check required SIWE fields
    expect(payload.siwe.issuedAt).toBeDefined()
    expect(typeof payload.siwe.issuedAt).toBe('string')
  },

  /**
   * Assert JWT has expected hash
   */
  hasSiweHash(payload: any) {
    expect(payload.siwe_hash).toBeDefined()
    expect(typeof payload.siwe_hash).toBe('string')
    expect(payload.siwe_hash).toMatch(/^0x[0-9a-fA-F]{64}$/)
  }
}

/**
 * Test helper for JWT authentication flow
 */
export class JwtTestFlow {
  private baseUrl: string
  private jwt: string | null = null
  private payload: any = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  /**
   * Authenticate and store JWT
   */
  async authenticate(authRequest: {
    endpoint?: string
    body: any
    headers?: Record<string, string>
  }): Promise<SupertestResponse> {
    const endpoint = authRequest.endpoint || '/api/gate-access'
    const req = request(this.baseUrl).post(endpoint)
    
    if (authRequest.headers) {
      Object.entries(authRequest.headers).forEach(([key, value]) => {
        req.set(key, value)
      })
    }
    
    const response = await req.send(authRequest.body)
    
    if (response.status === 200 && response.body?.accessToken) {
      this.jwt = response.body.accessToken
      this.payload = parseJwtPayload(this.jwt!) // <-- non-null assertion fixes TS2345
      console.log('🎫 JWT stored from authentication')
    }
    
    return response
  }

  /**
   * Make authenticated request with stored JWT
   */
  async authenticatedRequest(requestConfig: {
    method: 'get' | 'post' | 'put' | 'delete' | 'patch'
    endpoint: string
    body?: any
    headers?: Record<string, string>
  }): Promise<SupertestResponse> {
    if (!this.jwt) {
      throw new Error('No JWT available. Call authenticate() first.')
    }

    const req = request(this.baseUrl)[requestConfig.method](requestConfig.endpoint)
    
    // Add Bearer token (jwt is guaranteed to be non-null here)
    req.set('Authorization', `Bearer ${this.jwt}`)
    
    // Add additional headers
    if (requestConfig.headers) {
      Object.entries(requestConfig.headers).forEach(([key, value]) => {
        req.set(key, value)
      })
    }
    
    // Send body if present
    if (requestConfig.body !== undefined) {
      return req.send(requestConfig.body)
    }
    
    return req.send()
  }

  /**
   * Get stored JWT
   */
  getJwt(): string | null {
    return this.jwt
  }

  /**
   * Get parsed JWT payload
   */
  getPayload(): any {
    return this.payload
  }

  /**
   * Clear stored JWT
   */
  clear(): void {
    this.jwt = null
    this.payload = null
  }

  /**
   * Test JWT expiration by waiting
   * (Note: This would need actual time manipulation in production tests)
   */
  async testExpiration(waitMs: number = 1000): Promise<boolean> {
    if (!this.payload) return false
    
    const now = Math.floor(Date.now() / 1000)
    const exp = this.payload.exp
    
    if (!exp) return false
    
    // Check if already expired
    if (exp <= now) {
      return true
    }
    
    // Wait if needed (in real tests, you'd mock time)
    if (waitMs > 0) {
      await new Promise(resolve => setTimeout(resolve, waitMs))
    }
    
    return exp <= Math.floor(Date.now() / 1000)
  }
}

/**
 * Create test JWT scenarios
 */
export const jwtScenarios = {
  /**
   * Invalid JWT formats for testing
   */
  invalid: {
    malformed: 'not.a.jwt',
    missingParts: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    corruptedPayload: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.corrupted.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    emptySections: '..',
    wrongAlgorithm: 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.',
  },

  /**
   * Edge case Bearer formats
   */
  bearerFormats: {
    standard: (jwt: string) => `Bearer ${jwt}`,
    lowercase: (jwt: string) => `bearer ${jwt}`,
    uppercase: (jwt: string) => `BEARER ${jwt}`,
    extraSpaces: (jwt: string) => `Bearer  ${jwt}`,
    leadingSpace: (jwt: string) => ` Bearer ${jwt}`,
    trailingSpace: (jwt: string) => `Bearer ${jwt} `,
    tabbed: (jwt: string) => `Bearer\t${jwt}`,
    noSpace: (jwt: string) => `Bearer${jwt}`,
  },

  /**
   * Generate expired JWT payload (for testing)
   */
  expiredPayload: (address: string, tokenId: string) => ({
    sub: address,
    tokenId,
    iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
    exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    kind: 'access',
    auth: 'test',
  }),

  /**
   * Generate future JWT payload (not yet valid)
   */
  futurePayload: (address: string, tokenId: string) => ({
    sub: address,
    tokenId,
    iat: Math.floor(Date.now() / 1000),
    nbf: Math.floor(Date.now() / 1000) + 3600, // Valid in 1 hour
    exp: Math.floor(Date.now() / 1000) + 7200, // Expires in 2 hours
    kind: 'access',
    auth: 'test',
  }),
}

/**
 * Compare two JWTs to check if they're different
 */
export function areJwtsDifferent(jwt1: string, jwt2: string): boolean {
  if (jwt1 === jwt2) return false
  
  const payload1 = parseJwtPayload(jwt1)
  const payload2 = parseJwtPayload(jwt2)
  
  if (!payload1 || !payload2) return true
  
  // Compare key fields
  return (
    payload1.jti !== payload2.jti || // JWT ID should be different
    payload1.iat !== payload2.iat || // Issued at should be different
    payload1.exp !== payload2.exp    // Expiration might be different
  )
}

/**
 * Mock JWT for testing (NOT cryptographically valid)
 * Only use for testing error handling
 */
export function createMockJwt(payload: any, secret: string = 'test-secret'): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  }
  
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  
  // This is NOT a real signature - just for testing
  const fakeSignature = Buffer.from(secret).toString('base64url')
  
  return `${encodedHeader}.${encodedPayload}.${fakeSignature}`
}
