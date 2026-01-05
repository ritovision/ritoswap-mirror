// dapp/app/store/__tests__/ttsAudioStore.test.ts
import { useTtsAudioStore } from '../ttsAudioStore'

const resetStore = () => {
  useTtsAudioStore.setState({ entries: {} })
}

describe('useTtsAudioStore', () => {
  beforeEach(() => resetStore())

  it('starts empty', () => {
    const { entries } = useTtsAudioStore.getState()
    expect(entries).toEqual({})
  })

  it('setGenerating adds a generating entry', () => {
    const { setGenerating } = useTtsAudioStore.getState()
    setGenerating('m1', 'hash1')

    const entry = useTtsAudioStore.getState().entries.m1
    expect(entry).toEqual({
      messageId: 'm1',
      textHash: 'hash1',
      status: 'generating',
    })
  })

  it('setReady stores audio and marks ready', () => {
    const { setReady } = useTtsAudioStore.getState()
    const audio = new ArrayBuffer(8)
    setReady('m1', 'hash2', audio, 'audio/mpeg')

    const entry = useTtsAudioStore.getState().entries.m1
    expect(entry).toEqual({
      messageId: 'm1',
      textHash: 'hash2',
      status: 'ready',
      arrayBuffer: audio,
      contentType: 'audio/mpeg',
    })
  })

  it('clearEntry removes a single message', () => {
    const { setGenerating, clearEntry } = useTtsAudioStore.getState()
    setGenerating('m1', 'hash1')
    setGenerating('m2', 'hash2')

    clearEntry('m1')

    const { entries } = useTtsAudioStore.getState()
    expect(entries.m1).toBeUndefined()
    expect(entries.m2).toBeDefined()
  })

  it('clear wipes all entries', () => {
    const { setGenerating, clear } = useTtsAudioStore.getState()
    setGenerating('m1', 'hash1')
    setGenerating('m2', 'hash2')

    clear()

    const { entries } = useTtsAudioStore.getState()
    expect(entries).toEqual({})
  })
})
