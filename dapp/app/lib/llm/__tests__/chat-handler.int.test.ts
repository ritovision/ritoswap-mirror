// app/lib/llm/__tests__/chat-handler.int.test.ts

// ---------- HOISTED MOCK STATE (avoid "Cannot access before initialization") ----------
const hoisted = vi.hoisted(() => {
  const verifyAccessToken = vi.fn<
    (token: string) => Promise<{ payload: { sub: string; tokenId?: string } }>
  >(async () => ({ payload: { sub: 'u1', tokenId: 'tok-1' } }))

  const readJwtFromAny = vi.fn<
    (req?: Request | any, body?: any) => string | null
  >(() => null)

  const readBearerFromRequest = vi.fn<
    (req?: Request | any) => string | undefined
  >(() => undefined)

  const isQuotaFeatureActive = vi.fn<() => boolean>(() => false)
  const ensureAndCheck = vi.fn<
    () => Promise<{ allowed: boolean; window: { used: number; limit: number; resetAt: number }; remaining: number }>
  >(async () => ({
    allowed: true,
    window: { used: 0, limit: 100, resetAt: Date.now() + 60_000 },
    remaining: 100,
  }))
  const addUsage = vi.fn<(tokenId?: string, total?: number) => Promise<void>>(async () => {})
  const estimateInputTokensFromModelMessages = vi.fn<() => number>(() => 5)
  const estimateTokensFromText = vi.fn<() => number>(() => 5)

  return {
    verifyAccessToken,
    readJwtFromAny,
    readBearerFromRequest,
    isQuotaFeatureActive,
    ensureAndCheck,
    addUsage,
    estimateInputTokensFromModelMessages,
    estimateTokensFromText,
  }
})

// ---------- MODULE MOCKS (only reference `hoisted` or literals) ----------
vi.mock('@logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

vi.mock('@/app/config/ai.server', () => {
  // Export a MUTABLE object so tests can flip flags (we'll cast to any when mutating)
  const aiServerConfig = {
    provider: 'openai' as 'openai' | 'lmstudio',
    models: ['model-a', 'model-b'],
    getModel: (i: number) => (i <= 0 ? 'model-a' : ['model-a', 'model-b'][i - 1]),
    requiresJwt: false,
    quota: { tokens: 10_000, windowSec: 60 },
    limits: { maxOutputTokens: 64, maxDurationSec: 30 },
    secrets: { openaiApiKey: 'sk-test' },
    temperature: 0.2,
    baseUrl: 'http://localhost:9999',
  }
  return { aiServerConfig }
})

vi.mock('@lib/mcp/tools', () => ({
  toolRegistry: {
    getAll: () => [
      {
        tool: {
          name: 'the_tool',
          description: 'does a thing',
          inputSchema: {
            type: 'object',
            properties: { q: { type: 'string' } },
            required: ['q'],
          },
        },
      },
    ],
  },
}))

vi.mock('@lib/jwt/server', () => ({
  verifyAccessToken: hoisted.verifyAccessToken,
  readJwtFromAny: hoisted.readJwtFromAny,
  readBearerFromRequest: hoisted.readBearerFromRequest,
}))

vi.mock('@lib/quotas/token-quota', () => ({
  isQuotaFeatureActive: hoisted.isQuotaFeatureActive,
  ensureAndCheck: hoisted.ensureAndCheck,
  addUsage: hoisted.addUsage,
  estimateInputTokensFromModelMessages: hoisted.estimateInputTokensFromModelMessages,
  estimateTokensFromText: hoisted.estimateTokensFromText,
}))

// ---------- IMPORTS AFTER MOCKS ----------
import { handleChatRequest } from '../handler'
import { providerRegistry } from '../providers/registry'
import { aiServerConfig } from '@/app/config/ai.server'

// Handy handles
const {
  verifyAccessToken,
  readJwtFromAny,
  readBearerFromRequest,
  isQuotaFeatureActive,
  ensureAndCheck,
  addUsage,
  estimateInputTokensFromModelMessages,
  estimateTokensFromText,
} = hoisted

// ---------- Helpers ----------
async function readSse(res: Response) {
  const events: any[] = []
  const body = res.body
  if (!body) return events

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  let result = await reader.read()
  while (!result.done) {
    const { value } = result
    buffer += decoder.decode(value, { stream: true })

    const frames = buffer.split('\n\n')
    buffer = frames.pop() || ''

    for (const frame of frames) {
      const dataLines = frame
        .split('\n')
        .filter((l) => l.startsWith('data: '))
        .map((l) => l.slice(6).trim())

      if (!dataLines.length) continue
      if (dataLines[0] === '[DONE]') {
        events.push({ type: '[DONE]' })
        continue
      }
      try {
        const payload = JSON.parse(dataLines.join('\n'))
        events.push(payload)
      } catch {
        // ignore bad frames
      }
    }
    result = await reader.read()
  }
  return events
}

function makeReq(body: any) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as any // NextRequest-compatible enough for tests
}

// ---------- Test lifecycle ----------
beforeEach(() => {
  // Reset hoisted mocks to default behavior
  verifyAccessToken.mockReset().mockResolvedValue({ payload: { sub: 'u1', tokenId: 'tok-1' } })
  readJwtFromAny.mockReset().mockReturnValue(null)
  readBearerFromRequest.mockReset().mockReturnValue(undefined)
  isQuotaFeatureActive.mockReset().mockReturnValue(false)
  ensureAndCheck.mockReset().mockResolvedValue({
    allowed: true,
    window: { used: 0, limit: 100, resetAt: Date.now() + 60_000 },
    remaining: 100,
  })
  addUsage.mockReset().mockResolvedValue(undefined)
  estimateInputTokensFromModelMessages.mockReset().mockReturnValue(5)
  estimateTokensFromText.mockReset().mockReturnValue(5)

  // Default config (cast to any to avoid readonly typing from module declarations)
  ;(aiServerConfig as any).requiresJwt = false
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------- Tests ----------
describe('handleChatRequest (integration-ish)', () => {
  it('streams a simple response (no tools)', async () => {
    // Fake provider #1: initial stream emits pure text
    const fakeLlm = {
      stream: async function* () {
        yield { content: [{ type: 'text', text: 'Hello ' }] }
        yield { content: [{ type: 'text', text: 'world!' }] }
      },
    }
    vi.spyOn(providerRegistry as any, 'getProvider').mockReturnValue(fakeLlm as any)

    const req = makeReq({ messages: [{ role: 'user', content: 'hi' }] })
    const res = await handleChatRequest(req)

    expect(res.headers.get('content-type')).toContain('text/event-stream')

    const events = await readSse(res)
    const types = events.map((e) => e.type)

    expect(types[0]).toBe('start')
    expect(types).toContain('start-step')
    expect(types).toContain('text-start')
    expect(types).toContain('text-delta')
    expect(types).toContain('text-end')
    expect(types).toContain('finish-step')
    expect(types[types.length - 2]).toBe('finish') // last structured event
    expect(events[events.length - 1]).toEqual({ type: '[DONE]' })
  })

  it('handles a tool call then follow-up LLM response', async () => {
    // 1st LLM call: emits a tool call
    const initialLlm = {
      stream: async function* () {
        yield {
          content: [{ type: 'text', text: 'Thinking...' }],
          tool_calls: [{ id: 'tc1', name: 'the_tool', args: { q: 'abc' } }],
        }
      },
    }

    // 2nd LLM call: emits final text using tool result
    const followupLlm = {
      stream: async function* () {
        yield { content: [{ type: 'text', text: 'Tool says OK.' }] }
      },
    }

    const getProviderSpy = vi
      .spyOn(providerRegistry as any, 'getProvider')
      .mockImplementationOnce(() => initialLlm as any) // initial call
      .mockImplementationOnce(() => followupLlm as any) // follow-up call

    // Mock MCP HTTP call
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 'x',
          result: {
            content: [
              { type: 'text', text: 'TOOL OK' },
              { type: 'json', data: { foo: 'bar' } },
            ],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ) as any,
    )

    const req = makeReq({ messages: [{ role: 'user', content: 'do it' }] })
    const res = await handleChatRequest(req)
    const events = await readSse(res)

    const types = events.map((e) => e.type)
    expect(types).toContain('tool-input-start')
    expect(types).toContain('tool-input-available')
    expect(types).toContain('tool-output-available')
    expect(types).toContain('text-delta') // follow-up text
    expect(types).toContain('finish')

    // MCP was called once with JSON-RPC payload
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const fetchArgs = fetchMock.mock.calls[0] as any
    const body = await (fetchArgs?.[1]?.body?.toString?.() ?? fetchArgs?.[1]?.body)
    expect(String(body)).toContain('"method":"tools/call"')

    // Provider was retrieved twice (initial + follow-up)
    expect(getProviderSpy).toHaveBeenCalledTimes(2)
  })

  it('400 when "messages" is missing', async () => {
    const res = await handleChatRequest(makeReq({}))
    expect(res.status).toBe(400)
    const payload = (await res.json()) as any
    expect(payload.error).toMatch(/Missing "messages"/)
  })

  it('401 when JWT required and missing', async () => {
    ;(aiServerConfig as any).requiresJwt = true
    isQuotaFeatureActive.mockReturnValue(false)
    readJwtFromAny.mockReturnValue(null)

    const res = await handleChatRequest(makeReq({ messages: [] }))
    expect(res.status).toBe(401)
    const payload = (await res.json()) as any
    expect(payload.error).toMatch(/Unauthorized: missing JWT/)

    // reset
    ;(aiServerConfig as any).requiresJwt = false
  })

  it('429 when quota pre-check fails', async () => {
    ;(aiServerConfig as any).requiresJwt = true
    readJwtFromAny.mockReturnValue('Bearer abc')
    verifyAccessToken.mockResolvedValueOnce({ payload: { sub: 'u2', tokenId: 'tok-2' } })
    isQuotaFeatureActive.mockReturnValue(true)
    ensureAndCheck.mockResolvedValueOnce({
      allowed: false,
      window: { used: 100, limit: 100, resetAt: Date.now() + 60_000 },
      remaining: 0,
    })

    const res = await handleChatRequest(
      makeReq({ messages: [{ role: 'user', content: 'hi' }] }),
    )
    expect(res.status).toBe(429)
    const payload = (await res.json()) as any
    expect(payload.error).toBe('Quota exceeded')

    // reset
    ;(aiServerConfig as any).requiresJwt = false
    isQuotaFeatureActive.mockReturnValue(false)
  })

  it('records quota usage after stream (post-accounting)', async () => {
    // Turn on quota + jwt, allow pre-check
    ;(aiServerConfig as any).requiresJwt = true
    readJwtFromAny.mockReturnValue('Bearer abc')
    verifyAccessToken.mockResolvedValueOnce({ payload: { sub: 'u3', tokenId: 'tok-3' } })
    isQuotaFeatureActive.mockReturnValue(true)
    ensureAndCheck.mockResolvedValueOnce({
      allowed: true,
      window: { used: 0, limit: 1000, resetAt: Date.now() + 60_000 },
      remaining: 1000,
    })

    // Simple one-chunk LLM output ("Hello")
    vi.spyOn(providerRegistry as any, 'getProvider').mockReturnValue({
      stream: async function* () {
        yield { content: [{ type: 'text', text: 'Hello' }] }
      },
    } as any)

    const res = await handleChatRequest(
      makeReq({ messages: [{ role: 'user', content: 'hi' }] }),
    )
    await readSse(res) // ensure stream completes

    // 5 (input) + 5 (output) from our mocks
    expect(addUsage).toHaveBeenCalledWith('tok-3', 10)

    // reset
    ;(aiServerConfig as any).requiresJwt = false
    isQuotaFeatureActive.mockReturnValue(false)
  })

  // ---- New tests ----
  it('emits error frame and finishes when LLM stream throws mid-stream', async () => {
    // provider that yields then throws
    const throwingLlm = {
      stream: async function* () {
        yield { content: [{ type: 'text', text: 'Partial...' }] }
        throw new Error('stream-broken')
      },
    }
    vi.spyOn(providerRegistry as any, 'getProvider').mockReturnValue(throwingLlm as any)

    const req = makeReq({ messages: [{ role: 'user', content: 'please fail' }] })
    const res = await handleChatRequest(req)
    const events = await readSse(res)
    const types = events.map((e) => e.type)

    // should have some text and an error event, then finish and DONE
    expect(types).toContain('text-delta')
    expect(types).toContain('error')
    expect(types).toContain('finish')
    expect(events[events.length - 1]).toEqual({ type: '[DONE]' })
  })

  it('handles MCP RPC error: emits tool-output-error and still follows up', async () => {
    // initial LLM emits tool call
    const initialLlm = {
      stream: async function* () {
        yield {
          content: [{ type: 'text', text: 'Calling tool...' }],
          tool_calls: [{ id: 'tcX', name: 'the_tool', args: { q: 'x' } }],
        }
      },
    }
    // follow-up returns a normal text
    const followupLlm = {
      stream: async function* () {
        yield { content: [{ type: 'text', text: 'After error, replied.' }] }
      },
    }

    const getProviderSpy = vi
      .spyOn(providerRegistry as any, 'getProvider')
      .mockImplementationOnce(() => initialLlm as any)
      .mockImplementationOnce(() => followupLlm as any)

    // Mock MCP to return an RPC error (json.error)
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 'x',
          error: { code: 123, message: 'boom' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ) as any,
    )

    const req = makeReq({ messages: [{ role: 'user', content: 'call tool' }] })
    const res = await handleChatRequest(req)
    const events = await readSse(res)
    const types = events.map((e) => e.type)

    // should include tool input frames, a tool-output-error frame, and finally text-delta from follow-up
    expect(types).toContain('tool-input-start')
    expect(types).toContain('tool-input-available')
    expect(types).toContain('tool-output-error')
    expect(types).toContain('text-delta')
    expect(types).toContain('finish')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getProviderSpy).toHaveBeenCalledTimes(2)
  })
})
