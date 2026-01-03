// dapp/app/store/__tests__/modalStore.test.ts
import { useModalStore } from '../modalStore'

const resetStore = () => {
  useModalStore.setState({
    open: 'none',
    payload: undefined,
  })
}

describe('modalStore', () => {
  beforeEach(() => resetStore())

  it('starts closed with undefined payload', () => {
    const state = useModalStore.getState()
    expect(state.open).toBe('none')
    expect(state.payload).toBeUndefined()
    expect(typeof state.openModal).toBe('function')
    expect(typeof state.closeModal).toBe('function')
  })

  it('openModal sets modal type and payload', () => {
    const retry = vi.fn()
    useModalStore
      .getState()
      .openModal('error', { error: { message: 'Oops', details: 'bad', retry } })

    const state = useModalStore.getState()
    expect(state.open).toBe('error')
    if (state.payload && 'error' in state.payload) {
      expect(state.payload.error.message).toBe('Oops')
      expect(state.payload.error.details).toBe('bad')

      // ensure payload functions are preserved/callable
      state.payload.error.retry?.()
    }
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('opening a different modal replaces (not merges) payload', () => {
    const retry = vi.fn()
    useModalStore
      .getState()
      .openModal('error', { error: { message: 'Oops', retry } })

    useModalStore.getState().openModal('mode', { battleMode: 'rapBattle' })

    const state = useModalStore.getState()
    expect(state.open).toBe('mode')
    if (state.payload && 'battleMode' in state.payload) {
      expect(state.payload.battleMode).toBe('rapBattle')
    }
    // previous error payload should be gone
    expect(state.payload && 'error' in state.payload ? state.payload.error : undefined)
      .toBeUndefined()
  })

  it('closeModal resets to none and clears payload', () => {
    useModalStore.getState().openModal('battleForm', { battleMode: 'agentBattle' })
    useModalStore.getState().closeModal()

    const state = useModalStore.getState()
    expect(state.open).toBe('none')
    expect(state.payload).toBeUndefined()
  })

  it('can open without payload', () => {
    useModalStore.getState().openModal('mode')
    const state = useModalStore.getState()
    expect(state.open).toBe('mode')
    expect(state.payload).toBeUndefined()
  })
})
