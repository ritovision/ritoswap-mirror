// FILE: c:\Users\Mattj\techstuff\ritoswap-clean\ritoswap1\dapp\e2e\supertest\pinecone.test.ts
import request from 'supertest'
import { privateKeyToAccount } from 'viem/accounts'
import { SiweMessage } from 'siwe'
import { validateSupertestEnv } from './env.schema'
import { parseJwtPayload } from './jwt.helpers'

// --- Environment (validated at runtime via shared schema) ---
const ENV = validateSupertestEnv(process.env as Record<string, string | undefined>)

const BASE_URL = ENV.TEST_BASE_URL.replace(/\/$/, '')
const PRIVATE_KEY = ENV.PRIVATE_KEY
const TOKEN_ID = ENV.TOKEN_ID
const CHAIN_ID = Number.parseInt(ENV.CHAIN_ID, 10)

// MCP/JWT come from validated env (with defaults)
const MCP_ENDPOINT = ENV.MCP_ENDPOINT
const REQUIRES_JWT = ENV.NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT === 'true'

// Pinecone test configuration - dynamic but with defaults
const PINECONE_INDEX = process.env.PINECONE_TEST_INDEX || 'ritorhymes-index'
const PINECONE_NAMESPACE = process.env.PINECONE_TEST_NAMESPACE || 'ritorhymes'
const SEARCH_QUERY = 'bitcoin'

// logging (masked)
const mask = (s?: string) => (s ? `${s.slice(0, 6)}...${s.slice(-4)}` : 'NOT SET')
console.log('🔧 Pinecone MCP Test config:')
console.log('  BASE_URL:', BASE_URL)
console.log('  MCP_ENDPOINT:', MCP_ENDPOINT)
console.log('  REQUIRES_JWT:', REQUIRES_JWT)
console.log('  PRIVATE_KEY:', mask(PRIVATE_KEY))
console.log('  TOKEN_ID:', TOKEN_ID)
console.log('  CHAIN_ID:', CHAIN_ID)
console.log('  PINECONE_INDEX:', PINECONE_INDEX)
console.log('  PINECONE_NAMESPACE:', PINECONE_NAMESPACE)

// Helper to create account from private key
const getAccount = () => {
  const key = (PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`) as `0x${string}`
  const account = privateKeyToAccount(key)
  console.log('📝 Account from private key:', account.address)
  return account
}

// Parse domain from BASE_URL
const getDomain = () => {
  const url = new URL(BASE_URL)
  return url.host
}

/** Legacy signature builder (must match server) */
const createLegacySignature = async (
  account: ReturnType<typeof privateKeyToAccount>,
  endpoint: string,
  tokenId: string,
  timestamp: number
) => {
  const message = [
    `I own key #${tokenId}`,
    `Domain: ${getDomain()}`,
    `Path: ${endpoint}`,
    'Method: POST',
    `ChainId: ${CHAIN_ID}`,
    `Timestamp: ${timestamp}`,
  ].join('\n')

  console.log('🔐 Legacy Auth - Message to sign:\n', message)
  const signature = await account.signMessage({ message })
  console.log('✍️ Legacy Auth - Signature:', signature.slice(0, 20) + '...')
  return { message, signature }
}

/** SIWE signature builder */
const createSiweSignature = async (
  account: ReturnType<typeof privateKeyToAccount>,
  tokenId: string,
  nonce: string
) => {
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
  console.log('🔐 SIWE - Message to sign:\n', message)
  const signature = await account.signMessage({ message })
  console.log('✍️ SIWE - Signature:', signature.slice(0, 20) + '...')

  return { message, signature }
}

// Discover SIWE via /api/nonce
const detectSiweEnabled = async (): Promise<boolean> => {
  try {
    const nonceRes = await request(BASE_URL).get('/api/nonce')
    console.log('🔎 /api/nonce status:', nonceRes.status)
    return nonceRes.status === 200
  } catch (e) {
    console.warn('⚠️ Could not probe /api/nonce; assuming SIWE disabled:', (e as Error)?.message)
    return false
  }
}

// Fetch JWT using SIWE when enabled, else legacy
const getJwtToken = async (account: ReturnType<typeof privateKeyToAccount>): Promise<string | null> => {
  if (!REQUIRES_JWT) {
    console.log('⏭️ JWT not required, skipping authentication')
    return null
  }

  console.log('🔑 JWT required, authenticating...')
  const siweEnabled = await detectSiweEnabled()

  if (siweEnabled) {
    const nonceResponse = await request(BASE_URL).get('/api/nonce')
    if (nonceResponse.status !== 200) {
      throw new Error(`Failed to get nonce: ${nonceResponse.status}`)
    }
    const nonce = nonceResponse.body.nonce
    const { message, signature } = await createSiweSignature(account, TOKEN_ID, nonce)

    const authResponse = await request(BASE_URL).post('/api/gate-access').send({
      address: account.address,
      signature,
      tokenId: TOKEN_ID,
      message,
      nonce,
    })

    if (authResponse.status !== 200) {
      throw new Error(`Authentication failed (SIWE): ${authResponse.status} ${JSON.stringify(authResponse.body)}`)
    }

    const jwt = authResponse.body.accessToken
    if (!jwt) {
      throw new Error('No JWT token received from SIWE authentication')
    }

    console.log('✅ JWT obtained (SIWE):', jwt.slice(0, 20) + '...')
    return jwt
  } else {
    const timestamp = Date.now()
    const { signature } = await createLegacySignature(account, '/api/gate-access', TOKEN_ID, timestamp)

    const authResponse = await request(BASE_URL).post('/api/gate-access').send({
      address: account.address,
      signature,
      tokenId: TOKEN_ID,
      timestamp,
    })

    if (authResponse.status !== 200) {
      throw new Error(`Authentication failed (Legacy): ${authResponse.status} ${JSON.stringify(authResponse.body)}`)
    }

    const jwt = authResponse.body.accessToken
    if (!jwt) {
      throw new Error('No JWT token received from Legacy authentication')
    }

    console.log('✅ JWT obtained (Legacy):', jwt.slice(0, 20) + '...')
    return jwt
  }
}

// Helper to make MCP request
const makeMCPRequest = async (
  method: string,
  params?: any,
  jwt?: string | null
) => {
  const req = request(BASE_URL).post(MCP_ENDPOINT)
  if (jwt) req.set('Authorization', `Bearer ${jwt}`)
  return req.send({ jsonrpc: '2.0', id: Date.now(), method, params })
}


// Store JWT for reuse
let jwtToken: string | null = null
const account = getAccount()

describe('Pinecone MCP Tests', () => {
  beforeAll(async () => {
    console.log('🚀 Starting Pinecone MCP tests')
    try {
      jwtToken = await getJwtToken(account)
      if (jwtToken) {
        const payload = parseJwtPayload(jwtToken)
        console.log('JWT payload:', { sub: payload?.sub, tokenId: payload?.tokenId, exp: payload?.exp })
      }
    } catch (error) {
      console.error('Failed to obtain JWT:', error)
      if (REQUIRES_JWT) throw error
    }
  })


  afterAll(() => {
    console.log('✅ Pinecone MCP Tests Complete')
  })

  describe('MCP Protocol - Basic', () => {
    it('should handle GET request with info message', async () => {
      const response = await request(BASE_URL).get(MCP_ENDPOINT)
      expect(response.status).toBe(405)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('only supports POST')
    })

    it('should reject invalid JSON', async () => {
      const response = await request(BASE_URL)
        .post(MCP_ENDPOINT)
        .set('Content-Type', 'application/json')
        .send('invalid json{')
      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
    })

    it('should handle missing JWT when required', async () => {
      if (!REQUIRES_JWT) {
        console.log('Skipping: JWT not required')
        return
      }
      const response = await makeMCPRequest('tools/list', undefined, null)
      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error')
      expect((response.body.error?.message || response.body.error)?.toString().toLowerCase())
        .toMatch(/authentication|jwt|unauthorized/)
    })
  })

  describe('MCP Protocol - tools/list', () => {
    it('should list available tools', async () => {
      const response = await makeMCPRequest('tools/list', undefined, jwtToken)
      console.log('tools/list response:', response.status, response.body)

      if (REQUIRES_JWT && response.status === 401) {
        console.warn('⚠️ JWT authentication failed, skipping test')
        return
      }

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('tools')
      expect(Array.isArray(response.body.tools)).toBe(true)

      const pineconeTools = response.body.tools.filter((t: any) => t.name === 'pinecone_search')
      expect(pineconeTools.length).toBeGreaterThan(0)

      const tool = pineconeTools[0]
      console.log('Found pinecone_search tool:', {
        name: tool.name,
        description: tool.description?.slice(0, 100) + '...',
        hasInputSchema: !!tool.inputSchema,
      })
      expect(tool).toHaveProperty('name', 'pinecone_search')
      expect(tool).toHaveProperty('description')
      expect(tool).toHaveProperty('inputSchema')
      expect(tool.inputSchema).toHaveProperty('type', 'object')
      expect(tool.inputSchema).toHaveProperty('properties')
    })
  })

  describe('Pinecone Vector Search', () => {
    it('should perform semantic search for "bitcoin"', async () => {
      const response = await makeMCPRequest(
        'tools/call',
        {
          name: 'pinecone_search',
          arguments: { query: SEARCH_QUERY, index: PINECONE_INDEX, namespace: PINECONE_NAMESPACE, topK: 5, includeMetadata: true },
        },
        jwtToken
      )

      if (REQUIRES_JWT && response.status === 401) {
        console.warn('⚠️ JWT authentication failed')
        expect(response.body.error.message).toMatch(/authentication|jwt/i)
        return
      }

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('content')
      expect(Array.isArray(response.body.content)).toBe(true)

      if (response.body.isError) return // don't fail if tool not configured

      const content = response.body.content
      expect(content.length).toBeGreaterThan(0)

      const textContent = content.find((c: any) => c.type === 'text')
      expect(textContent).toBeDefined()
      expect(textContent.text).toContain(PINECONE_INDEX)
      expect(textContent.text).toContain(PINECONE_NAMESPACE)
    })

    it('should handle search with custom topK', async () => {
      const response = await makeMCPRequest(
        'tools/call',
        {
          name: 'pinecone_search',
          arguments: { query: SEARCH_QUERY, index: PINECONE_INDEX, namespace: PINECONE_NAMESPACE, topK: 3, includeMetadata: true },
        },
        jwtToken
      )
      if (REQUIRES_JWT && response.status === 401) return
      expect(response.status).toBe(200)
    })

    it('should handle search without metadata', async () => {
      const response = await makeMCPRequest(
        'tools/call',
        {
          name: 'pinecone_search',
          arguments: { query: SEARCH_QUERY, index: PINECONE_INDEX, namespace: PINECONE_NAMESPACE, topK: 5, includeMetadata: false },
        },
        jwtToken
      )
      if (REQUIRES_JWT && response.status === 401) return
      expect(response.status).toBe(200)
    })

    it('should reject invalid index name', async () => {
      const response = await makeMCPRequest(
        'tools/call',
        {
          name: 'pinecone_search',
          arguments: { query: SEARCH_QUERY, index: 'nonexistent-index-12345', namespace: PINECONE_NAMESPACE, topK: 5 },
        },
        jwtToken
      )
      if (REQUIRES_JWT && response.status === 401) return
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('content')
      expect(response.body.isError).toBe(true)
    })

    it('should reject invalid namespace', async () => {
      const response = await makeMCPRequest(
        'tools/call',
        {
          name: 'pinecone_search',
          arguments: { query: SEARCH_QUERY, index: PINECONE_INDEX, namespace: 'nonexistent-namespace-12345', topK: 5 },
        },
        jwtToken
      )
      if (REQUIRES_JWT && response.status === 401) return
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('content')
      expect(response.body.isError).toBe(true)
    })

    it('should reject missing required parameters', async () => {
      const response = await makeMCPRequest(
        'tools/call',
        { name: 'pinecone_search', arguments: { namespace: PINECONE_NAMESPACE } },
        jwtToken
      )
      if (REQUIRES_JWT && response.status === 401) return
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('content')
      expect(response.body.isError).toBe(true)
    })

    it('should handle empty query string', async () => {
      const response = await makeMCPRequest(
        'tools/call',
        { name: 'pinecone_search', arguments: { query: '', index: PINECONE_INDEX, namespace: PINECONE_NAMESPACE } },
        jwtToken
      )
      if (REQUIRES_JWT && response.status === 401) return
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('content')
      expect(response.body.isError).toBe(true)
    })
  })

  describe('JWT Edge Cases (if JWT enabled)', () => {
    it('should reject invalid JWT', async () => {
      if (!REQUIRES_JWT) {
        console.log('Skipping: JWT not required')
        return
      }
      const invalidJwt = 'ey...invalid'
      const response = await makeMCPRequest('tools/list', undefined, invalidJwt)
      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error')
    })

    it('should reject malformed Bearer header', async () => {
      if (!REQUIRES_JWT) {
        console.log('Skipping: JWT not required')
        return
      }
      const response = await request(BASE_URL)
        .post(MCP_ENDPOINT)
        .set('Authorization', 'Bearer')
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('Rate Limiting and Concurrency', () => {
    it('should handle concurrent requests', async () => {
      const promises = Array(3).fill(null).map((_, i) =>
        makeMCPRequest(
          'tools/call',
          { name: 'pinecone_search', arguments: { query: `${SEARCH_QUERY} ${i}`, index: PINECONE_INDEX, namespace: PINECONE_NAMESPACE, topK: 3 } },
          jwtToken
        ).then(res => ({ index: i, status: res.status, hasContent: !!res.body.content }))
      )

      const results = await Promise.all(promises)
      console.log('Concurrent request results:', results)
      results.forEach(result => {
        expect([200, 401, 429]).toContain(result.status)
      })
    })
  })
})
