import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import AssistantAudioButton from '../AssistantAudioButton'

const {
  storeState,
  useTtsAudioStoreMock,
  openModalMock,
  musicMock,
} = vi.hoisted(() => {
  const storeState = {
    entries: {} as Record<string, any>,
    setGenerating: vi.fn(),
    setReady: vi.fn(),
    clearEntry: vi.fn(),
  }
  const useTtsAudioStoreMock = vi.fn((selector: any) => selector(storeState))
  const openModalMock = vi.fn()
  const musicMock = {
    unlock: vi.fn(),
    loadArrayBuffer: vi.fn(),
    seek: vi.fn(),
    currentTrackId: null as string | null,
  }
  return { storeState, useTtsAudioStoreMock, openModalMock, musicMock }
})

vi.mock('@store/ttsAudioStore', () => ({
  useTtsAudioStore: useTtsAudioStoreMock,
}))

vi.mock('@store/modalStore', () => ({
  useModalStore: () => ({ openModal: openModalMock }),
}))

vi.mock('../../../MusicPlayer/MusicProvider', () => ({
  useMusic: () => musicMock,
}))

vi.mock('@config/tts.public', () => ({
  ttsPublicConfig: { apiPath: '/api/tts', requiresJwt: false },
}))

vi.mock('@lib/jwt/client', () => ({
  getStoredToken: vi.fn(() => null),
}))

const originalFetch = global.fetch

describe('AssistantAudioButton', () => {
  beforeEach(() => {
    storeState.entries = {}
    storeState.setGenerating.mockClear()
    storeState.setReady.mockClear()
    storeState.clearEntry.mockClear()
    openModalMock.mockClear()
    musicMock.unlock.mockClear()
    musicMock.loadArrayBuffer.mockClear()
    musicMock.seek.mockClear()
    musicMock.currentTrackId = null

    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(4),
      headers: { get: () => 'audio/mpeg' },
    })) as any
  })

  afterEach(() => {
    global.fetch = originalFetch!
  })

  it('requests TTS and loads audio on click', async () => {
    render(
      <AssistantAudioButton
        messageId="m1"
        parts={[{ type: 'text', text: 'Hello there' }]}
      />
    )

    const button = screen.getByRole('button', { name: /play audio/i })

    await act(async () => {
      fireEvent.click(button)
    })

    expect(musicMock.unlock).toHaveBeenCalledTimes(1)
    expect(storeState.setGenerating).toHaveBeenCalledWith('m1', expect.any(String))

    const fetchCall = (global.fetch as any).mock.calls[0]
    expect(fetchCall[0]).toBe('/api/tts')
    expect(fetchCall[1].method).toBe('POST')
    expect(fetchCall[1].headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(fetchCall[1].body)).toEqual({ text: 'Hello there', messageId: 'm1' })

    expect(storeState.setReady).toHaveBeenCalledWith(
      'm1',
      expect.any(String),
      expect.any(ArrayBuffer),
      'audio/mpeg'
    )
    expect(musicMock.loadArrayBuffer).toHaveBeenCalledWith(expect.any(ArrayBuffer), {
      autoplay: true,
      name: 'RapBotRito',
      trackId: 'm1',
    })
  })

  it('shows generating state when entry is generating', () => {
    storeState.entries = {
      m1: { messageId: 'm1', textHash: 'hash', status: 'generating' },
    }

    render(
      <AssistantAudioButton
        messageId="m1"
        parts={[{ type: 'text', text: 'Hello there' }]}
      />
    )

    const button = screen.getByRole('button', { name: /generating audio/i })
    expect(button).toBeDisabled()
    expect(screen.getByText('Generating...')).toBeInTheDocument()
  })
})
