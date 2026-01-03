
// Hoisted mocks
const H = vi.hoisted(() => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  aiServerConfig: {
    image: {
      provider: 'openai',
      openai: { apiKey: 'test-key', model: 'dall-e-3' },
      defaults: { size: '512x512', quality: 'medium' },
    },
    vision: {
      provider: 'openai',
      model: 'gpt-4o-mini',
    },
    secrets: {
      openaiApiKey: 'test-vision-key',
    },
    baseUrl: 'http://localhost:1234',
  },
  failMock: vi.fn(),
}))

vi.mock('@logger', () => ({ createLogger: () => H.logger }))
vi.mock('@config/ai.server', () => ({ aiServerConfig: H.aiServerConfig }))
vi.mock('../tool-errors', () => ({
  fail: (msg: string) => H.failMock(msg),
  errorResultShape: (msg: string) => ({ isError: true, content: [{ type: 'text', text: msg }] }),
}))

import toolDef from '../image-generate-workflow'

describe('image-generate-workflow tool', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    H.failMock.mockImplementation((msg: string) => {
      const err: any = new Error(msg)
      err.isToolFailure = true
      throw err
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('generates image with alt text (happy path)', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({
          data: [{ b64_json: 'fake-base64-image-data' }],
        })),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({
          choices: [{ message: { content: 'A colorful sunset over mountains' } }],
        })),
      } as any)

    const result = await toolDef.handler({ prompt: 'sunset over mountains' } as any)

    expect(result.content).toHaveLength(2)

    const jsonItem = result.content.find((c: any) => c.type === 'json')
    const data = (jsonItem as any)?.data
    expect(data).toMatchObject({
      kind: 'store-image',
      mime: 'image/png',
      width: 512,
      height: 512,
      alt: 'A colorful sunset over mountains',
      dataBase64: 'fake-base64-image-data',
    })
    expect(data.name).toMatch(/\.png$/)

    const textItem = result.content.find((c: any) => c.type === 'text')
    expect((textItem as any)?.text).toContain('<img src="store://image/')
    expect((textItem as any)?.text).toContain('alt="A colorful sunset over mountains"')
    expect((textItem as any)?.text).toContain('width="512" height="512"')

    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('fails when prompt is missing', async () => {
    await expect(toolDef.handler({ prompt: '' } as any)).resolves.toMatchObject({
      isError: true,
      content: [{ type: 'text', text: expect.stringContaining('Missing prompt') }],
    })
  })

  it('handles OpenAI image API error', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: vi.fn().mockResolvedValue(JSON.stringify({ error: { message: 'Rate limit exceeded' } })),
    } as any)

    const result = await toolDef.handler({ prompt: 'test' } as any)

    expect(result.isError).toBe(true)
    expect(result.content?.[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Rate limit exceeded'),
    })
  })

  it('falls back to generic alt text when vision fails', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ data: [{ b64_json: 'img-data' }] })),
      } as any)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Vision API error'),
      } as any)

    const result = await toolDef.handler({ prompt: 'test image' } as any)

    const jsonItem = result.content.find((c: any) => c.type === 'json')
    const data = (jsonItem as any)?.data
    expect(data.alt).toBe('Generated image')
    expect(H.logger.warn).toHaveBeenCalled()
  })

  it('uses LM Studio for alt text when configured', async () => {
    H.aiServerConfig.vision.provider = 'lmstudio'

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ data: [{ b64_json: 'img' }] })),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({
          choices: [{ message: { content: 'LM Studio generated alt text' } }],
        })),
      } as any)

    const result = await toolDef.handler({ prompt: 'test' } as any)

    const jsonItem = result.content.find((c: any) => c.type === 'json')
    const data = (jsonItem as any)?.data
    expect(data.alt).toBe('LM Studio generated alt text')

    const fetchMock = global.fetch as any
    const altTextCall = fetchMock.mock.calls[1]
    expect(altTextCall[0]).toContain('http://localhost:1234/chat/completions')

    H.aiServerConfig.vision.provider = 'openai' // reset
  })

  it('handles image URL response instead of b64_json', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({
          data: [{ url: 'https://example.com/image.png' }],
        })),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([137, 80, 78, 71]).buffer),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ choices: [{ message: { content: 'Alt' } }] })),
      } as any)

    const result = await toolDef.handler({ prompt: 'test' } as any)

    const jsonItem = result.content.find((c: any) => c.type === 'json')
    const data = (jsonItem as any)?.data
    expect(data.dataBase64).toBeTruthy()
    expect(global.fetch).toHaveBeenCalledWith('https://example.com/image.png')
  })

  it('enforces size from env config', async () => {
    H.aiServerConfig.image.defaults.size = '1024x1024'

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ data: [{ b64_json: 'data' }] })),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ choices: [{ message: { content: 'Alt' } }] })),
      } as any)

    const result = await toolDef.handler({ prompt: 'test' } as any)

    const jsonItem = result.content.find((c: any) => c.type === 'json')
    const data = (jsonItem as any)?.data
    expect(data.width).toBe(1024)
    expect(data.height).toBe(1024)

    const fetchMock = global.fetch as any
    const imageApiCall = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(imageApiCall.size).toBe('1024x1024')

    H.aiServerConfig.image.defaults.size = '512x512' // reset
  })

  it('normalizes custom name with .png extension', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ data: [{ b64_json: 'data' }] })),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ choices: [{ message: { content: 'Alt' } }] })),
      } as any)

    const result = await toolDef.handler({ prompt: 'test', name: 'My Cool Image!' } as any)

    const jsonItem = result.content.find((c: any) => c.type === 'json')
    const data = (jsonItem as any)?.data
    expect(data.name).toMatch(/^my-cool-image.*\.png$/)
  })
})