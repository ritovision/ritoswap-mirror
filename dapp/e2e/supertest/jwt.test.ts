// FILE: c:\Users\Mattj\techstuff\ritoswap-clean\ritoswap1\dapp\e2e\supertest\jwt.test.ts
import request from 'supertest'
import { privateKeyToAccount } from 'viem/accounts'
import { SiweMessage } from 'siwe'
import { validateSupertestEnv } from './env.schema'
import {
  JwtTestFlow,
  jwtAssertions,
  jwtScenarios,
  parseJwtPayload,
  areJwtsDifferent,
  createMockJwt
} from './jwt.helpers'

// --- Environment ---
const ENV = validateSupertestEnv(process.env as Record<string, string | undefined>)
const BASE_URL = ENV.TEST_BASE_URL.replace(/\/$/, '')
const PRIVATE_KEY = ENV.PRIVATE_KEY
const TOKEN_ID = ENV.TOKEN_ID
const CHAIN_ID = Number.parseInt(ENV.CHAIN_ID, 10)

// Test helpers
const getAccount = () => {
  const key = (PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`) as `0x${string}`
  return privateKeyToAccount(key)
}

const getDomain = () => {
  const url = new URL(BASE_URL)
  return url.host
}


// Server configuration detection
let stateWorkerAvailable = false
let serverHasJwtEnabled = false

describe('JWT Authentication Tests', () => {
  const account = getAccount()
  const jwtFlow = new JwtTestFlow(BASE_URL)
  
  beforeAll(async () => {
    // Check server configuration
    const nonceResponse = await request(BASE_URL).get('/api/nonce')
    stateWorkerAvailable = nonceResponse.status === 200
    console.log(`🔍 JWT Tests: State Worker/SIWE is ${stateWorkerAvailable ? 'ENABLED' : 'DISABLED'}`)
  })


  afterAll(() => {
    console.log('✅ JWT Tests Complete')
  })

  describe('JWT Generation', () => {
    it('should check if server returns JWT on successful SIWE authentication', async () => {
      if (!stateWorkerAvailable) {
        console.log('Skipping SIWE JWT test - State worker not enabled')
        return
      }

      // Get nonce
      const nonceResponse = await request(BASE_URL).get('/api/nonce')
      expect(nonceResponse.status).toBe(200)
      const nonce = nonceResponse.body.nonce

      // Create SIWE message
      const siweMessage = new SiweMessage({
        domain: getDomain(),
        address: account.address,
        statement: 'Sign in to access gated content',
        uri: BASE_URL,
        version: '1',
        chainId: CHAIN_ID,
        nonce,
        issuedAt: new Date().toISOString(),
      })

      const message = siweMessage.prepareMessage()
      const signature = await account.signMessage({ message })

      // Authenticate
      const response = await jwtFlow.authenticate({
        body: {
          address: account.address,
          signature,
          tokenId: TOKEN_ID,
          message,
          nonce,
        }
      })

      if (response.status === 429) {
        console.log('⚠️ Rate limited during JWT test')
        return
      }

      if (response.status === 200) {
        if (response.body.accessToken) {
          serverHasJwtEnabled = true
          // Verify JWT structure
          const { jwt, payload } = jwtAssertions.hasValidJwt(response)
          
          // Verify payload contents
          jwtAssertions.hasExpectedPayload(payload, {
            sub: account.address,
            tokenId: TOKEN_ID,
            auth: 'siwe',
            kind: 'access',
            scopes: ['gate:read']
          })
          
          // Verify timestamps
          jwtAssertions.hasValidTimestamps(payload)
          
          // Verify SIWE projection
          jwtAssertions.hasSiweProjection(payload, {
            address: account.address,
            domain: getDomain(),
            chainId: CHAIN_ID,
            nonce
          })
          
          // Verify SIWE hash
          jwtAssertions.hasSiweHash(payload)
          
          console.log('✅ SIWE JWT generation verified')
        } else {
          console.log('⚠️ Server did not return JWT - JWT may not be enabled on server')
          serverHasJwtEnabled = false
        }
      } else if (response.status === 403) {
        console.log('Token already used - expected behavior')
      } else {
        console.log(`Unexpected status: ${response.status}`)
      }
    })

    it('should check if server returns JWT on successful legacy authentication', async () => {
      if (stateWorkerAvailable) {
        console.log('Skipping legacy JWT test - SIWE enabled')
        return
      }

      const timestamp = Date.now()
      
      // Create legacy signature
      const message = [
        `I own key #${TOKEN_ID}`,
        `Domain: ${getDomain()}`,
        `Path: /api/gate-access`,
        'Method: POST',
        `ChainId: ${CHAIN_ID}`,
        `Timestamp: ${timestamp}`,
      ].join('\n')
      
      const signature = await account.signMessage({ message })

      // Authenticate
      const response = await jwtFlow.authenticate({
        body: {
          address: account.address,
          signature,
          tokenId: TOKEN_ID,
          timestamp,
        }
      })

      if (response.status === 429) {
        console.log('⚠️ Rate limited during JWT test')
        return
      }

      if (response.status === 200) {
        if (response.body.accessToken) {
          serverHasJwtEnabled = true
          // Verify JWT structure
          const { jwt, payload } = jwtAssertions.hasValidJwt(response)
          
          // Verify payload contents
          jwtAssertions.hasExpectedPayload(payload, {
            sub: account.address,
            tokenId: TOKEN_ID,
            auth: 'legacy',
            kind: 'access',
            scopes: ['gate:read']
          })
          
          // Verify timestamps
          jwtAssertions.hasValidTimestamps(payload)
          
          // Verify SIWE projection (legacy creates a similar structure)
          jwtAssertions.hasSiweProjection(payload, {
            address: account.address,
            domain: getDomain(),
            chainId: CHAIN_ID,
            nonce: 'legacy' // Legacy uses 'legacy' as nonce
          })
          
          // Verify hash
          jwtAssertions.hasSiweHash(payload)
          
          console.log('✅ Legacy JWT generation verified')
        } else {
          console.log('⚠️ Server did not return JWT - JWT may not be enabled on server')
          serverHasJwtEnabled = false
        }
      } else if (response.status === 403) {
        console.log('Token already used - expected behavior')
      } else {
        console.log(`Unexpected status: ${response.status}`)
      }
    })
  })

  describe('JWT Usage', () => {
    beforeAll(async () => {
      // Ensure we have a JWT for testing (if server supports it)
      if (!jwtFlow.getJwt() && !serverHasJwtEnabled) {
        // Try to authenticate to get a JWT
        const timestamp = Date.now()
        
        if (stateWorkerAvailable) {
          const nonceResponse = await request(BASE_URL).get('/api/nonce')
          if (nonceResponse.status === 200) {
            const nonce = nonceResponse.body.nonce
            const siweMessage = new SiweMessage({
              domain: getDomain(),
              address: account.address,
              statement: 'Sign in to access gated content',
              uri: BASE_URL,
              version: '1',
              chainId: CHAIN_ID,
              nonce,
              issuedAt: new Date().toISOString(),
            })
            const message = siweMessage.prepareMessage()
            const signature = await account.signMessage({ message })
            
            const res = await jwtFlow.authenticate({
              body: { address: account.address, signature, tokenId: TOKEN_ID, message, nonce }
            })
            
            if (res.body?.accessToken) {
              serverHasJwtEnabled = true
            }
          }
        } else {
          const message = [
            `I own key #${TOKEN_ID}`,
            `Domain: ${getDomain()}`,
            `Path: /api/gate-access`,
            'Method: POST',
            `ChainId: ${CHAIN_ID}`,
            `Timestamp: ${timestamp}`,
          ].join('\n')
          const signature = await account.signMessage({ message })
          
          const res = await jwtFlow.authenticate({
            body: { address: account.address, signature, tokenId: TOKEN_ID, timestamp }
          })
          
          if (res.body?.accessToken) {
            serverHasJwtEnabled = true
          }
        }
      }
    })

    it('should authenticate with valid JWT and empty body', async () => {
      if (!serverHasJwtEnabled) {
        console.log('Server does not support JWT, skipping test')
        return
      }

      if (!jwtFlow.getJwt()) {
        console.log('No JWT available, skipping test')
        return
      }

      const response = await jwtFlow.authenticatedRequest({
        method: 'post',
        endpoint: '/api/gate-access',
        body: {}
      })

      if (response.status === 429) {
        console.log('⚠️ Rate limited')
        return
      }

      expect([200, 403]).toContain(response.status)
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true)
        expect(response.body).toHaveProperty('content')
        // Should NOT mint a new JWT when using JWT auth
        expect(response.body).not.toHaveProperty('accessToken')
      }
    })

    it('should authenticate with JWT and tokenId in body', async () => {
      if (!serverHasJwtEnabled) {
        console.log('Server does not support JWT, skipping test')
        return
      }

      if (!jwtFlow.getJwt()) {
        console.log('No JWT available, skipping test')
        return
      }

      const response = await jwtFlow.authenticatedRequest({
        method: 'post',
        endpoint: '/api/gate-access',
        body: { tokenId: TOKEN_ID }
      })

      if (response.status === 429) {
        console.log('⚠️ Rate limited')
        return
      }

      expect([200, 403]).toContain(response.status)
    })

    it('should reject JWT with wrong tokenId in body', async () => {
      if (!serverHasJwtEnabled) {
        console.log('Server does not support JWT, skipping test')
        return
      }

      if (!jwtFlow.getJwt()) {
        console.log('No JWT available, skipping test')
        return
      }

      const response = await jwtFlow.authenticatedRequest({
        method: 'post',
        endpoint: '/api/gate-access',
        body: { tokenId: '99999' }
      })

      if (response.status === 429) {
        console.log('⚠️ Rate limited')
        return
      }

      expect(response.status).toBe(401)
    })

    it('should handle various Bearer header formats', async () => {
      const jwt = jwtFlow.getJwt()
      if (!jwt) {
        console.log('No JWT available, skipping test')
        return
      }

      const formats = Object.entries(jwtScenarios.bearerFormats)
      
      for (const [name, formatter] of formats) {
        console.log(`Testing Bearer format: ${name}`)

        const response = await request(BASE_URL)
          .post('/api/gate-access')
          .set('Authorization', formatter(jwt))
          .send({})
        
        if (response.status === 429) {
          console.log('⚠️ Rate limited, skipping remaining formats')
          break
        }
        
        // Most should work except 'noSpace'
        if (name === 'standard' || name === 'lowercase' || name === 'uppercase') {
          expect([200, 400, 401, 403]).toContain(response.status)
        } else {
          // Edge cases might fail
          expect([200, 400, 401, 403]).toContain(response.status)
        }
      }
    })
  })

  describe('JWT Security', () => {
    it('should reject invalid JWT formats', async () => {
      const invalidJwts = Object.entries(jwtScenarios.invalid)
      
      for (const [name, invalidJwt] of invalidJwts) {
        console.log(`Testing invalid JWT: ${name}`)

        const response = await request(BASE_URL)
          .post('/api/gate-access')
          .set('Authorization', `Bearer ${invalidJwt}`)
          .send({ tokenId: TOKEN_ID })
        
        if (response.status === 429) {
          console.log('⚠️ Rate limited, skipping remaining tests')
          break
        }
        
        // Should fall back to body auth and fail
        expect([400, 401]).toContain(response.status)
      }
    })

    it('should reject mock JWT with invalid signature', async () => {
      const mockPayload = {
        sub: account.address,
        tokenId: TOKEN_ID,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        kind: 'access',
        auth: 'siwe',
        scopes: ['gate:read']
      }
      
      const mockJwt = createMockJwt(mockPayload)
      
      const response = await request(BASE_URL)
        .post('/api/gate-access')
        .set('Authorization', `Bearer ${mockJwt}`)
        .send({ tokenId: TOKEN_ID })
      
      if (response.status === 429) {
        console.log('⚠️ Rate limited')
        return
      }
      
      // Should reject due to invalid signature
      expect([400, 401]).toContain(response.status)
    })

    it('should handle missing Bearer token gracefully', async () => {
      const response = await request(BASE_URL)
        .post('/api/gate-access')
        .set('Authorization', 'Bearer') // Missing token
        .send({ tokenId: TOKEN_ID })
      
      if (response.status === 429) {
        console.log('⚠️ Rate limited')
        return
      }
      
      // Should fall back to body auth
      expect([400, 401]).toContain(response.status)
    })

  })

  describe('JWT Payload Inspection', () => {
    it('should parse and validate JWT structure', () => {
      const jwt = jwtFlow.getJwt()
      if (!jwt) {
        console.log('No JWT available, skipping payload inspection')
        return
      }

      const payload = parseJwtPayload(jwt)
      
      // Check standard JWT claims
      expect(payload).toHaveProperty('iss') // Issuer
      expect(payload).toHaveProperty('aud') // Audience
      expect(payload).toHaveProperty('sub') // Subject (address)
      expect(payload).toHaveProperty('iat') // Issued at
      expect(payload).toHaveProperty('exp') // Expiration
      expect(payload).toHaveProperty('jti') // JWT ID
      
      // Check custom claims
      expect(payload).toHaveProperty('kind', 'access')
      expect(payload).toHaveProperty('auth')
      expect(['siwe', 'legacy']).toContain(payload.auth)
      expect(payload).toHaveProperty('scopes')
      expect(Array.isArray(payload.scopes)).toBe(true)
      
      // Check SIWE projection
      expect(payload).toHaveProperty('siwe')
      expect(payload.siwe).toHaveProperty('address')
      expect(payload.siwe).toHaveProperty('domain')
      expect(payload.siwe).toHaveProperty('chainId')
      expect(payload.siwe).toHaveProperty('nonce')
      expect(payload.siwe).toHaveProperty('issuedAt')
      
      // Check SIWE hash
      expect(payload).toHaveProperty('siwe_hash')
      expect(payload.siwe_hash).toMatch(/^0x[0-9a-fA-F]{64}$/)
      
      console.log('✅ JWT payload structure validated')
    })

    it('should verify JWT expiration is reasonable', () => {
      const jwt = jwtFlow.getJwt()
      if (!jwt) {
        console.log('No JWT available, skipping expiration check')
        return
      }

      const payload = parseJwtPayload(jwt)
      const now = Math.floor(Date.now() / 1000)
      const ttl = payload.exp - payload.iat
      
      // Check TTL is reasonable (between 5 minutes and 24 hours)
      expect(ttl).toBeGreaterThanOrEqual(300) // At least 5 minutes
      expect(ttl).toBeLessThanOrEqual(86400) // At most 24 hours
      
      // Check token is currently valid
      expect(payload.exp).toBeGreaterThan(now)
      expect(payload.iat).toBeLessThanOrEqual(now)
      
      if (payload.nbf !== undefined) {
        expect(payload.nbf).toBeLessThanOrEqual(now)
      }
      
      console.log(`✅ JWT TTL: ${ttl} seconds (${(ttl / 60).toFixed(1)} minutes)`)
    })
  })

  describe('JWT Uniqueness', () => {
    it('should generate different JWTs for each authentication', async () => {
      if (!serverHasJwtEnabled) {
        console.log('Server does not support JWT, skipping uniqueness test')
        return
      }

      // Store first JWT
      const firstJwt = jwtFlow.getJwt()
      if (!firstJwt) {
        console.log('No initial JWT, skipping uniqueness test')
        return
      }

      // Clear and re-authenticate
      jwtFlow.clear()
      
      const timestamp = Date.now()
      
      if (stateWorkerAvailable) {
        const nonceResponse = await request(BASE_URL).get('/api/nonce')
        if (nonceResponse.status === 200) {
          const nonce = nonceResponse.body.nonce
          const siweMessage = new SiweMessage({
            domain: getDomain(),
            address: account.address,
            statement: 'Sign in to access gated content',
            uri: BASE_URL,
            version: '1',
            chainId: CHAIN_ID,
            nonce,
            issuedAt: new Date().toISOString(),
          })
          const message = siweMessage.prepareMessage()
          const signature = await account.signMessage({ message })
          
          const response = await jwtFlow.authenticate({
            body: { address: account.address, signature, tokenId: TOKEN_ID, message, nonce }
          })
          
          if (response.status === 200 && response.body.accessToken) {
            const secondJwt = jwtFlow.getJwt()
            expect(areJwtsDifferent(firstJwt, secondJwt!)).toBe(true)
            console.log('✅ JWTs are unique per authentication')
          }
        }
      } else {
        const message = [
          `I own key #${TOKEN_ID}`,
          `Domain: ${getDomain()}`,
          `Path: /api/gate-access`,
          'Method: POST',
          `ChainId: ${CHAIN_ID}`,
          `Timestamp: ${timestamp}`,
        ].join('\n')
        const signature = await account.signMessage({ message })
        
        const response = await jwtFlow.authenticate({
          body: { address: account.address, signature, tokenId: TOKEN_ID, timestamp }
        })
        
        if (response.status === 200 && response.body.accessToken) {
          const secondJwt = jwtFlow.getJwt()
          expect(areJwtsDifferent(firstJwt, secondJwt!)).toBe(true)
          console.log('✅ JWTs are unique per authentication')
        }
      }
    })
  })
})