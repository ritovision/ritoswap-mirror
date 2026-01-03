/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { NextRequest } from 'next/server'

// -------------------------
// Hoisted shared mocks/state
// -------------------------
const H = vi.hoisted(() => {
  const handleChatRequest = vi.fn()
  const aiServerConfigState = { limits: { maxDurationSec: 42 }, requiresJwt: false } as any
  return { handleChatRequest, aiServerConfigState }
})

// -------------------------
// Inline module mocks
// -------------------------
vi.mock('@config/ai.server', () => ({
  aiServerConfig: H.aiServerConfigState,
}))

vi.mock('@lib/llm/handler', () => {
  const handleChatRequest = H.handleChatRequest
  // default stub returns minimal SSE body
  handleChatRequest.mockResolvedValue(
    new Response('data: {"type":"start"}\n\ndata: [DONE]\n\n', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
    }),
  )
  return { handleChatRequest }
})

// Import the route AFTER mocks are set up
import { POST, runtime, maxDuration } from '@/app/api/chat/route'
import { handleChatRequest } from '@lib/llm/handler'

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
    req.on('data', (c: unknown) => chunks.push(typeof c === 'string' ? new TextEncoder().encode(c) : (c as Uint8Array)))
    req.on('end', resolve)
    req.on('error', reject)
  })
  return Buffer.concat(chunks).toString('utf8')
}

function makeServerJSON() {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.method === 'POST' && req.url === '/api/chat') {
        const raw = await readRawBody(req)
        const body = raw ? JSON.parse(raw) : undefined
        const webReq = new Request('http://localhost/api/chat', {
          method: 'POST',
          headers: nodeHeadersToFetchHeaders(req.headers),
          body: JSON.stringify(body ?? {}),
        })
        const webRes = await POST(webReq as unknown as NextRequest)
        res.statusCode = webRes.status
        webRes.headers.forEach((v, k) => res.setHeader(k, v))
        res.end(await webRes.text())
        return
      }
      res.statusCode = 404
      res.end('not found')
    } catch (e: any) {
      res.statusCode = 500
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: e?.message ?? String(e) }))
    }
  })
}

// -------------------------
// Tests
// -------------------------
describe('/api/chat route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST delegates to handleChatRequest and returns SSE headers/body', async () => {
    const srv = makeServerJSON()

    const res = await request(srv)
      .post('/api/chat')
      .set('content-type', 'application/json')
      .send({ messages: [{ role: 'user', content: 'hello' }] })

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/event-stream/i)
    expect(res.text).toContain('[DONE]')

    expect(handleChatRequest).toHaveBeenCalledTimes(1)
    const arg = (handleChatRequest as any).mock.calls[0][0]
    expect(arg).toBeInstanceOf(Request)
  })

  it('exports runtime and default maxDuration', () => {
    expect(runtime).toBe('nodejs')
    expect(maxDuration).toBe(300)
  })

  it('SSE contract: headers + event order + [DONE]', async () => {
    ;(handleChatRequest as any).mockResolvedValueOnce(
      new Response(
        [
          'data: {"type":"start","messageId":"m1"}',
          'data: {"type":"text-start","id":"t1"}',
          'data: {"type":"text-delta","id":"t1","delta":"Hel"}',
          'data: {"type":"text-delta","id":"t1","delta":"lo"}',
          'data: {"type":"text-end","id":"t1"}',
          'data: {"type":"finish"}',
          'data: [DONE]',
          '',
        ].join('\n\n'),
        {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'x-vercel-ai-ui-message-stream': 'v1',
          },
        },
      ),
    )

    const srv = makeServerJSON()
    const res = await request(srv)
      .post('/api/chat')
      .set('content-type', 'application/json')
      .send({ messages: [{ role: 'user', content: 'hello' }] })

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/event-stream/i)
    expect(res.headers['cache-control']).toContain('no-cache')
    expect(res.headers['x-accel-buffering']).toBe('no')
    expect(res.headers['x-vercel-ai-ui-message-stream']).toBe('v1')

    const events = res.text
      .trim()
      .split('\n\n')
      .map(block =>
        block
          .split('\n')
          .filter(l => l.startsWith('data: '))
          .map(l => l.slice(6).trim())
          .join('\n'),
      )
      .filter(Boolean)

    expect(events.at(-1)).toBe('[DONE]')
    const payloads = events.slice(0, -1).map(e => JSON.parse(e))
    expect(payloads.map(p => p.type)).toEqual(['start', 'text-start', 'text-delta', 'text-delta', 'text-end', 'finish'])
  })

  it('passes through non-200 JSON from handler (e.g., quota 429)', async () => {
    ;(handleChatRequest as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Quota exceeded', remaining: 0 }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const srv = makeServerJSON()
    const res = await request(srv)
      .post('/api/chat')
      .set('content-type', 'application/json')
      .send({ messages: [{ role: 'user', content: 'hi' }] })

    expect(res.status).toBe(429)
    expect(res.headers['content-type']).toMatch(/application\/json/i)
    expect(res.body).toEqual({ error: 'Quota exceeded', remaining: 0 })
  })
})
