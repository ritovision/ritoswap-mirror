// @vitest-environment node

const H = vi.hoisted(() => {
  const loggerSpy = {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }
  const aiConfig = { requiresJwt: false }
  const readJwtFromAnyMock = vi.fn()
  const verifyAccessTokenMock = vi.fn()
  const providerMock = { synthesize: vi.fn() }
  const getProviderMock = vi.fn(() => providerMock)

  return {
    loggerSpy,
    aiConfig,
    readJwtFromAnyMock,
    verifyAccessTokenMock,
    providerMock,
    getProviderMock,
  }
})

vi.mock('@logger', () => ({
  createLogger: () => H.loggerSpy,
}))

vi.mock('@config/ai.server', () => ({
  aiServerConfig: H.aiConfig,
}))

vi.mock('@lib/tts/providers/registry', () => ({
  getTtsProvider: H.getProviderMock,
}))

vi.mock('@lib/jwt/server', () => ({
  readJwtFromAny: H.readJwtFromAnyMock,
  verifyAccessToken: H.verifyAccessTokenMock,
}))

import { POST } from '../route'

function makeReq(body: unknown, headers?: Record<string, string>) {
  return {
    headers: new Headers(headers ?? {}),
    json: async () => body,
  } as any
}

async function readJson(res: Response) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

describe('POST /api/tts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    H.aiConfig.requiresJwt = false
    H.readJwtFromAnyMock.mockReturnValue(null)
    H.verifyAccessTokenMock.mockResolvedValue(undefined)
    H.providerMock.synthesize.mockResolvedValue({
      audio: new ArrayBuffer(2),
      contentType: 'audio/mpeg',
    })
    H.getProviderMock.mockImplementation(() => H.providerMock)
  })

  it('returns 400 when JSON is invalid', async () => {
    const res = await POST({
      json: async () => {
        throw new Error('bad json')
      },
    } as any)
    const body = await readJson(res)
    expect(res.status).toBe(400)
    expect(body).toEqual({ error: 'Invalid JSON body' })
  })

  it('returns 400 when text is missing', async () => {
    const res = await POST(makeReq({ messageId: 'm1' }))
    const body = await readJson(res)
    expect(res.status).toBe(400)
    expect(body).toEqual({ error: 'Missing "text"' })
  })

  it('returns 401 when JWT is required and missing', async () => {
    H.aiConfig.requiresJwt = true
    H.readJwtFromAnyMock.mockReturnValue(null)

    const res = await POST(makeReq({ text: 'hello' }))
    const body = await readJson(res)
    expect(res.status).toBe(401)
    expect(body).toEqual({ error: 'Unauthorized: missing JWT' })
  })

  it('returns 401 when JWT is invalid', async () => {
    H.aiConfig.requiresJwt = true
    H.readJwtFromAnyMock.mockReturnValue('token')
    H.verifyAccessTokenMock.mockRejectedValue(new Error('bad token'))

    const res = await POST(makeReq({ text: 'hello' }))
    const body = await readJson(res)
    expect(res.status).toBe(401)
    expect(body).toEqual({ error: 'Unauthorized: invalid JWT' })
    expect(H.loggerSpy.warn).toHaveBeenCalledWith('[auth] invalid JWT', {
      error: 'bad token',
    })
  })

  it('returns audio response on success', async () => {
    const res = await POST(makeReq({ text: '  hello  ', messageId: 'm1' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(res.headers.get('X-Message-Id')).toBe('m1')

    const buf = await res.arrayBuffer()
    expect(buf.byteLength).toBe(2)
    expect(H.providerMock.synthesize).toHaveBeenCalledWith('hello')
  })

  it('returns 503 when provider is disabled', async () => {
    H.getProviderMock.mockImplementation(() => {
      throw new Error('TTS provider is disabled')
    })

    const res = await POST(makeReq({ text: 'hello' }))
    const body = await readJson(res)
    expect(res.status).toBe(503)
    expect(body.error).toBe('TTS generation failed')
  })
})
