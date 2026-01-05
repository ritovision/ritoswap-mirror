// dapp/app/store/__tests__/chatModeStore.test.ts
import { useChatModeStore } from '../chatModeStore'
import { defaultFormData } from '@/components/chatBot/forms/battleFormSchema'
import type { ChatMode } from '@lib/llm/modes/types'

/**
 * Helper to reset the store between tests.
 */
const resetStore = () => {
  useChatModeStore.setState({
    activeMode: null,
    origin: null,
    lockedByProp: false,
    battleFormData: defaultFormData,
    // functions are preserved by Zustand; setState only overrides matching keys
  } as any)
}

describe('chatModeStore', () => {
  beforeEach(() => {
    resetStore()
  })

  it('has the correct initial state', () => {
    const state = useChatModeStore.getState()
    expect(state.activeMode).toBeNull()
    expect(state.origin).toBeNull()
    expect(state.lockedByProp).toBe(false)
    expect(state.battleFormData).toEqual(defaultFormData)
  })

  it('setMode sets activeMode, origin, and lockedByProp correctly', () => {
    const mockMode = 'battle' as unknown as ChatMode

    useChatModeStore.getState().setMode(mockMode, 'user')
    let state = useChatModeStore.getState()
    expect(state.activeMode).toBe(mockMode)
    expect(state.origin).toBe('user')
    expect(state.lockedByProp).toBe(false)

    useChatModeStore.getState().setMode(mockMode, 'prop')
    state = useChatModeStore.getState()
    expect(state.activeMode).toBe(mockMode)
    expect(state.origin).toBe('prop')
    expect(state.lockedByProp).toBe(true)
  })

  it('resetMode clears when not locked, and does nothing when lockedByProp is true', () => {
    const mockMode = 'battle' as unknown as ChatMode

    // not locked → should clear
    useChatModeStore.getState().setMode(mockMode, 'user')
    useChatModeStore.getState().resetMode()
    let state = useChatModeStore.getState()
    expect(state.activeMode).toBeNull()
    expect(state.origin).toBeNull()
    expect(state.lockedByProp).toBe(false)

    // locked → should not clear
    useChatModeStore.getState().setMode(mockMode, 'prop')
    useChatModeStore.getState().resetMode()
    state = useChatModeStore.getState()
    expect(state.activeMode).toBe(mockMode)
    expect(state.origin).toBe('prop')
    expect(state.lockedByProp).toBe(true)
  })

  it('updateUserField updates only user fields and preserves immutability', () => {
    const store = useChatModeStore.getState()
    const prev = store.battleFormData

    // pick any user field key dynamically
    const userKeys = Object.keys(prev.user ?? {})
    expect(userKeys.length).toBeGreaterThan(0) // ensure schema has at least one user field

    const field = userKeys[0] as keyof typeof prev.user
    const newValue = '__test-user-value__'

    store.updateUserField(field, newValue)

    const next = useChatModeStore.getState().battleFormData
    expect(next.user[field]).toBe(newValue)

    // immutability checks
    expect(next).not.toBe(prev)
    expect(next.user).not.toBe(prev.user)
    expect(next.chatbot).toBe(prev.chatbot) // untouched
  })

  it('updateChatbotField updates only chatbot fields and preserves immutability', () => {
    const store = useChatModeStore.getState()
    const prev = store.battleFormData

    const botKeys = Object.keys(prev.chatbot ?? {})
    expect(botKeys.length).toBeGreaterThan(0)

    const field = botKeys[0] as keyof typeof prev.chatbot
    const newValue = '__test-bot-value__'

    store.updateChatbotField(field, newValue)

    const next = useChatModeStore.getState().battleFormData
    expect(next.chatbot[field]).toBe(newValue)

    // immutability checks
    expect(next).not.toBe(prev)
    expect(next.chatbot).not.toBe(prev.chatbot)
    expect(next.user).toBe(prev.user) // untouched
  })

  it('clearBattleForm resets battleFormData back to defaultFormData', () => {
    const store = useChatModeStore.getState()

    // mutate something first
    const userKeys = Object.keys(store.battleFormData.user ?? {})
    if (userKeys.length > 0) {
      store.updateUserField(userKeys[0] as any, '__temp__')
    }

    store.clearBattleForm()
    const after = useChatModeStore.getState().battleFormData

    expect(after).toEqual(defaultFormData)
  })
})
