import { synthesizeElevenLabs } from '../elevenlabs'

const { ttsConfigState, loggerSpy } = vi.hoisted(() => {
  const loggerSpy = {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }
  const ttsConfigState = {
    provider: 'elevenlabs',
    elevenlabs: {
      apiKey: 'key',
      voiceId: 'voice',
      modelId: undefined as string | undefined,
      baseUrl: 'https://api.elevenlabs.io/v1',
      outputFormat: 'mp3_44100_128',
      voiceSettings: {
        stability: undefined as number | undefined,
        similarityBoost: undefined as number | undefined,
      },
    },
  }
  return { ttsConfigState, loggerSpy }
})

vi.mock('@config/tts.server', () => ({
  ttsServerConfig: ttsConfigState,
}))

vi.mock('@logger', () => ({
  createLogger: () => loggerSpy,
}))

const originalFetch = global.fetch

describe('synthesizeElevenLabs', () => {
  beforeEach(() => {
    ttsConfigState.elevenlabs.apiKey = 'key'
    ttsConfigState.elevenlabs.voiceId = 'voice'
    ttsConfigState.elevenlabs.modelId = undefined
    ttsConfigState.elevenlabs.baseUrl = 'https://api.elevenlabs.io/v1'
    ttsConfigState.elevenlabs.outputFormat = 'mp3_44100_128'
    ttsConfigState.elevenlabs.voiceSettings = {
      stability: undefined,
      similarityBoost: undefined,
    }

    loggerSpy.warn.mockClear()
    loggerSpy.info.mockClear()
    loggerSpy.debug.mockClear()
    loggerSpy.error.mockClear()
  })

  afterEach(() => {
    global.fetch = originalFetch!
  })

  it('throws when ElevenLabs is not configured', async () => {
    ttsConfigState.elevenlabs.apiKey = undefined
    ttsConfigState.elevenlabs.voiceId = undefined

    await expect(synthesizeElevenLabs('hi')).rejects.toThrow('ElevenLabs is not configured')
  })

  it('sends expected request payload and returns audio', async () => {
    const audio = new ArrayBuffer(3)
    ttsConfigState.elevenlabs.modelId = 'model'
    ttsConfigState.elevenlabs.outputFormat = 'mp3_22050_32'
    ttsConfigState.elevenlabs.voiceSettings = { stability: 0.3, similarityBoost: 0.7 }

    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => audio,
      headers: { get: () => 'audio/mpeg' },
    })) as any

    const result = await synthesizeElevenLabs('hello')
    expect(result.audio).toBe(audio)
    expect(result.contentType).toBe('audio/mpeg')

    const [url, options] = (global.fetch as any).mock.calls[0]
    expect(url).toBe(
      'https://api.elevenlabs.io/v1/text-to-speech/voice?output_format=mp3_22050_32'
    )
    expect(options.method).toBe('POST')
    expect(options.headers).toEqual({
      'xi-api-key': 'key',
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    })
    expect(JSON.parse(options.body)).toEqual({
      text: 'hello',
      model_id: 'model',
      voice_settings: { stability: 0.3, similarity_boost: 0.7 },
    })
  })

  it('throws with provider error message when request fails', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ detail: { message: 'Bad input' } }),
    })) as any

    await expect(synthesizeElevenLabs('oops')).rejects.toThrow('Bad input')
    expect(loggerSpy.warn).toHaveBeenCalledWith('ElevenLabs TTS error', {
      status: 400,
      message: 'Bad input',
    })
  })
})
