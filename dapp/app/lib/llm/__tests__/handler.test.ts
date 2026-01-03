// app/lib/llm/__tests__/handler.test.ts

// ── Mocks (must be declared before importing SUT) ─────────────────────────────

vi.mock('@/app/config/ai.server', () => {
  let REQUIRES_JWT = false

  const aiServerConfig = {
    provider: 'MockProvider',
    models: ['mock-model-0', 'mock-model-1'],
    get requiresJwt() {
      return REQUIRES_JWT
    },
    limits: { maxOutputTokens: 256 },
    quota: { tokens: 1000, windowSec: 60 },
    getModel: (index: number) =>
      ['mock-model-0', 'mock-model-1'][Math.max(0, index - 1)] || 'mock-model-1',
  }

  // test-only helper to flip the flag without mutating a readonly prop
  const __setRequiresJwt = (val: boolean) => {
    REQUIRES_JWT = val
  }

  return { aiServerConfig, __setRequiresJwt }
})

vi.mock('@lib/jwt/server', () => ({
  readJwtFromAny: vi.fn(),
  verifyAccessToken: vi.fn(),
}))

vi.mock('@lib/quotas/token-quota', () => ({
  isQuotaFeatureActive: vi.fn(() => false),
  ensureAndCheck: vi.fn(),
  addUsage: vi.fn(),
  estimateInputTokensFromModelMessages: vi.fn(() => 10),
  estimateTokensFromText: vi.fn(() => 5),
}))

vi.mock('../tool-bridge', () => ({
  getOpenAIToolSchemas: vi.fn(() => []),
  callMcpTool: vi.fn(),
  formatToolResult: vi.fn((res: any) =>
    typeof res === 'string' ? res : JSON.stringify(res)
  ),
}))

vi.mock('../message-converter', () => ({
  buildSystemPrompt: vi.fn((_ui, _meta, defSys) => defSys),
  convertUiToModelMessages: vi.fn((ui, _sys) => ui),
  summarizeMessages: vi.fn(() => ({ summary: 'ok' })),
}))

const partsNoop = {
  start: vi.fn(),
  startStep: vi.fn(),
  finishStep: vi.fn(),
  toolInputStart: vi.fn(),
  toolInputAvailable: vi.fn(),
  toolOutputError: vi.fn(),
  toolOutputAvailable: vi.fn(),
  finish: vi.fn(),
  error: vi.fn(),
}
vi.mock('../sse-stream', () => ({
  sseInit: vi.fn(() => ({
    stream: new ReadableStream(),
    parts: partsNoop,
    isClosed: () => false,
  })),
  createSseResponse: vi.fn((stream: ReadableStream) => new Response(stream, { status: 200 })),
}))

vi.mock('../llm-streaming', () => ({
  streamLLMResponse: vi.fn(async () => ({
    totalText: 'hello',
    gathered: { tool_calls: [] },
  })),
}))

vi.mock('../providers/registry', () => {
  const getProvider = vi.fn(() => ({
    stream: vi.fn(async () => ({ kind: 'MOCK_STREAM' })),
    bindTools: vi.fn(function (this: any) { return this }),
  }))
  return {
    providerRegistry: { getProvider },
  }
})

vi.mock('@logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

vi.mock('../utils', () => ({
  asArray: (x: any) => (Array.isArray(x) ? x : x ? [x] : []),
  isString: (x: any) => typeof x === 'string',
}))

// ── Import SUT & mocked modules AFTER mocks ───────────────────────────────────
import { handleChatRequest } from '../handler'
import * as Jwt from '@lib/jwt/server'
import * as Quota from '@lib/quotas/token-quota'
import * as LlmStreaming from '../llm-streaming'
import { providerRegistry } from '../providers/registry'
import { getOpenAIToolSchemas } from '../tool-bridge'
import * as AiConfigMock from '@/app/config/ai.server' // import the mocked module (gives us __setRequiresJwt)

// Access test-only setter from the mocked module without TS export typing issues
const setRequiresJwt = (val: boolean) => {
  ;(AiConfigMock as any).__setRequiresJwt(val)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeReq(body: any, headers: Record<string, string> = {}) {
  return {
    url: 'http://test.local/chat',
    json: async () => body,
    headers: new Headers(headers),
  } as any
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('handleChatRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setRequiresJwt(false)

    ;(Quota.isQuotaFeatureActive as any).mockReturnValue(false)
    ;(LlmStreaming.streamLLMResponse as any).mockResolvedValue({
      totalText: 'hello',
      gathered: { tool_calls: [] },
    })
    ;(getOpenAIToolSchemas as any).mockReturnValue([])
  })

  it('returns 400 when "messages" is missing or empty', async () => {
    const r1 = await handleChatRequest(makeReq({}))
    expect(r1.status).toBe(400)
    expect((await r1.json()).error).toMatch(/Missing "messages"/)

    const r2 = await handleChatRequest(makeReq({ messages: [] }))
    expect(r2.status).toBe(400)
    expect((await r2.json()).error).toMatch(/Missing "messages"/)
  })

  it('returns 401 when JWT is required but missing', async () => {
    setRequiresJwt(true)
    ;(Jwt.readJwtFromAny as any).mockReturnValue(null)

    const res = await handleChatRequest(makeReq({ messages: [{ role: 'user', content: 'hi' }] }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toMatch(/Unauthorized: missing JWT/)
  })

  it('returns 401 when JWT is invalid', async () => {
    setRequiresJwt(true)
    ;(Jwt.readJwtFromAny as any).mockReturnValue('bearer.token')
    ;(Jwt.verifyAccessToken as any).mockRejectedValue(new Error('bad jwt'))

    const res = await handleChatRequest(makeReq({ messages: [{ role: 'user', content: 'hi' }] }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toMatch(/Unauthorized: invalid JWT/)
  })

  it('returns 429 when quota pre-check blocks usage', async () => {
    setRequiresJwt(true)
    ;(Jwt.readJwtFromAny as any).mockReturnValue('bearer.token')
    ;(Jwt.verifyAccessToken as any).mockResolvedValue({ payload: { tokenId: 'tok123', sub: 'user1' } })
    ;(Quota.isQuotaFeatureActive as any).mockReturnValue(true)
    ;(Quota.ensureAndCheck as any).mockResolvedValue({
      allowed: false,
      remaining: 0,
      window: { used: 1000, limit: 1000, resetAt: 1700000000000 },
    })

    const res = await handleChatRequest(makeReq({ messages: [{ role: 'user', content: 'hi' }] }))
    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.error).toBe('Quota exceeded')
    expect(json.remaining).toBe(0)
    expect(json.resetAt).toBe(1700000000000)
  })

  it('starts SSE and kicks off LLM stream on happy path (no JWT, no tools)', async () => {
    setRequiresJwt(false)
    ;(getOpenAIToolSchemas as any).mockReturnValue([])

    const res = await handleChatRequest(
      makeReq({
        messages: [{ role: 'user', content: 'hello bot' }],
        metadata: { mode: 'none' },
        modelIndex: 1,
      })
    )

    expect(res).toBeInstanceOf(Response)
    expect(res.status).toBe(200)

    expect((providerRegistry.getProvider as any).mock.calls.length).toBeGreaterThan(0)
    expect((LlmStreaming.streamLLMResponse as any).mock.calls.length).toBe(1)
  })
})