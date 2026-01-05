/**
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

// -------------------------
// Hoisted shared mocks/state
// -------------------------
// Must be hoisted so vi.mock() factories can refer to them safely.
const H = vi.hoisted(() => {
  const handleRequest = vi.fn()
  const verifyAccessToken = vi.fn()
  const readJwtFromAny = vi.fn()
  const aiServerConfigState = { requiresJwt: false } as any

  // Minimal logger mock instance (used by createLogger)
  const mockLoggerInstance = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
  const createLogger = vi.fn(() => mockLoggerInstance)

  return {
    handleRequest,
    verifyAccessToken,
    readJwtFromAny,
    aiServerConfigState,
    mockLoggerInstance,
    createLogger,
  }
})

// -------------------------
// Inline module mocks
// -------------------------
// Mock logger so the route's logger.* calls succeed even on error paths
vi.mock('@logger', () => ({
  createLogger: H.createLogger,
  // some modules import default; include it just in case
  default: H.mockLoggerInstance,
}))

// Mock server-side ai config
vi.mock('@config/ai.server', () => ({
  aiServerConfig: H.aiServerConfigState,
}))

// Mock JWT helpers
vi.mock('@lib/jwt/server', () => ({
  verifyAccessToken: H.verifyAccessToken,
  readJwtFromAny: H.readJwtFromAny,
}))

// Mock MCP server so no tools/dispatcher run
vi.mock('@lib/mcp/server', () => ({
  mcpServer: { handleRequest: H.handleRequest },
}))

// Now import the route AFTER mocks have been established
import { POST, GET } from '@/app/api/mcp/route'

// helper to toggle the mocked config during tests
async function setRequiresJwt(val: boolean) {
  const mod = (await import('@config/ai.server')) as any
  mod.aiServerConfig.requiresJwt = val
}

// -------------------------
// Minimal Node HTTP adapter
// -------------------------
function nodeHeadersToFetchHeaders(nodeHeaders: IncomingMessage['headers']): Headers {
  const h = new Headers()
  for (const [k, v] of Object.entries(nodeHeaders)) {
    if (typeof v === 'string') h.set(k, v)
    else if (Array.isArray(v)) for (const vv of v) h.append(k, vv)
  }
  return h
}

async function readRawBody(req: IncomingMessage): Promise<string> {
  const chunks: Uint8Array[] = []
  await new Promise<void>((resolve, reject) => {
    req.on('data', (c: unknown) => {
      if (typeof c === 'string') {
        chunks.push(new TextEncoder().encode(c))
      } else {
        // Buffer in Node is a Uint8Array subtype; coerce for TS
        chunks.push(c as Uint8Array)
      }
    })
    req.on('end', () => resolve())
    req.on('error', reject)
  })
  return Buffer.concat(chunks).toString('utf8')
}

function makeServerJSON() {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.method === 'POST' && req.url === '/api/mcp') {
        const raw = await readRawBody(req)
        const body = raw ? JSON.parse(raw) : undefined
        const webReq = new Request('http://localhost/api/mcp', {
          method: 'POST',
          headers: nodeHeadersToFetchHeaders(req.headers),
          body: JSON.stringify(body ?? {}),
        })
        const webRes = await POST(webReq)
        res.statusCode = webRes.status
        webRes.headers.forEach((v, k) => res.setHeader(k, v))
        res.end(await webRes.text())
        return
      }

      if (req.method === 'GET' && req.url === '/api/mcp') {
        const webRes = await GET()
        res.statusCode = webRes.status
        webRes.headers.forEach((v, k) => res.setHeader(k, v))
        res.end(await webRes.text())
        return
      }

      res.statusCode = 404
      res.end('not found')
    } catch (e: any) {
      // Be conservative: if something goes wrong here, return JSON so tests can assert it.
      res.statusCode = 500
      res.setHeader('content-type', 'application/json')
      // ensure we don't crash while logging (logger is mocked above)
      try {
        // The route's logger also logs; we just return a stable JSON
        res.end(JSON.stringify({ error: e?.message ?? String(e) }))
      } catch {
        res.end(JSON.stringify({ error: 'internal test adapter failure' }))
      }
    }
  })
}

function makeServerRAW() {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'POST' && req.url === '/api/mcp') {
      const raw = await readRawBody(req) // may be invalid JSON
      const webReq = new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: nodeHeadersToFetchHeaders(req.headers),
        body: raw,
      })
      const webRes = await POST(webReq)
      res.statusCode = webRes.status
      webRes.headers.forEach((v, k) => res.setHeader(k, v))
      res.end(await webRes.text())
      return
    }
    res.statusCode = 404
    res.end('not found')
  })
}

// -------------------------
// Tests
// -------------------------
describe('/api/mcp route (Supertest contract)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await setRequiresJwt(false)
  })

  it('200 happy path: delegates to mcpServer.handleRequest and returns its response', async () => {
    const srv = makeServerJSON()

    // stub the mcp server to return a Response shape
    H.handleRequest.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, content: [{ type: 'text', text: 'stubbed' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const res = await request(srv).post('/api/mcp').set('content-type', 'application/json').send({ method: 'tools/list' })

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/json/i)
    expect(res.body).toEqual({ ok: true, content: [{ type: 'text', text: 'stubbed' }] })
    expect(H.readJwtFromAny).not.toHaveBeenCalled()
    expect(H.verifyAccessToken).not.toHaveBeenCalled()
    expect(H.handleRequest).toHaveBeenCalledTimes(1)
  })

  it('401 when requiresJwt=true and JWT is missing', async () => {
    const srv = makeServerJSON()
    await setRequiresJwt(true)
    H.readJwtFromAny.mockReturnValue(null)

    const res = await request(srv).post('/api/mcp').set('content-type', 'application/json').send({ method: 'tools/list' })

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'Unauthorized: missing JWT' })
    expect(H.verifyAccessToken).not.toHaveBeenCalled()
    expect(H.handleRequest).not.toHaveBeenCalled()
  })

  it('401 when requiresJwt=true and JWT is invalid', async () => {
    const srv = makeServerJSON()
    await setRequiresJwt(true)
    H.readJwtFromAny.mockReturnValue('bad.jwt')
    H.verifyAccessToken.mockRejectedValue(new Error('invalid token'))

    const res = await request(srv).post('/api/mcp').set('content-type', 'application/json').send({ method: 'tools/list' })

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'Unauthorized: invalid JWT' })
    expect(H.verifyAccessToken).toHaveBeenCalledTimes(1)
    expect(H.handleRequest).not.toHaveBeenCalled()
  })

  it('400 parse error for invalid JSON body', async () => {
    const srv = makeServerRAW()

    // Supertest will finish the request; route should return 400 JSON parse envelope
    const res = await request(srv).post('/api/mcp').set('content-type', 'application/json').send('{ invalid-json')

    expect(res.status).toBe(400)
    expect(res.headers['content-type']).toMatch(/application\/json/i)
    expect(res.body).toEqual({ error: { code: -32700, message: 'Parse error' } })
    expect(H.handleRequest).not.toHaveBeenCalled()
  })

  it('GET returns 405 with Allow header set to POST', async () => {
    const srv = makeServerJSON()
    const res = await request(srv).get('/api/mcp')

    expect(res.status).toBe(405)
    expect(res.headers['allow']).toBe('POST')
    expect(res.headers['content-type']).toMatch(/application\/json/i)
    expect(res.body).toEqual({
      error: 'MCP endpoint only supports POST requests',
      info: 'This is a Model Context Protocol (MCP) server endpoint',
    })
  })
})
