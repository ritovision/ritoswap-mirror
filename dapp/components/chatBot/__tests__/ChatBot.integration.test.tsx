// @vitest-environment happy-dom
import { render, waitFor } from '@testing-library/react'
import React from 'react'

// ----------- Mocks (keep them lightweight & deterministic) -----------

// CSS module needs a *default* export object with class names
vi.mock('../ChatWithPlayer.module.css', () => ({
  default: {
    stack: 'stack',
    fullWidthRow: 'fullWidthRow',
  },
}))

// No-op hooks
vi.mock('@hooks/useNFTData', () => ({ useNFTData: () => {} }))
vi.mock('@hooks/useHydrateToolImages', () => ({ default: () => {} }))

// Tool activity store (supports selector form)
vi.mock('@store/toolActivity', () => {
  const state: any = {
    uiToGroup: {},
    groups: {},
    activeGroupKey: undefined as string | undefined,
    attachActiveGroupToUiMessage: vi.fn(),
  }
  function useToolActivityStore(selector?: (s: any) => any) {
    return selector ? selector(state) : state
  }
  ;(useToolActivityStore as any).getState = () => state
  ;(useToolActivityStore as any).setState = (patch: any) => Object.assign(state, patch)
  return { useToolActivityStore }
})

// NFT store minimal shape
vi.mock('@store/nftStore', () => {
  const useNFTStore = () => ({
    hasNFT: false,
    tokenId: undefined,
    backgroundColor: undefined,
    keyColor: undefined,
    hasUsedTokenGate: false,
  })
  return { useNFTStore }
})

// Modal store with observable state so we can assert calls
vi.mock('@store/modalStore', () => {
  let open: string = 'none'
  const openModal = vi.fn((name: string) => { open = name })
  const closeModal = vi.fn(() => { open = 'none' })
  const useModalStore = () => ({ open, openModal, closeModal })
  // expose helpers for tests via the mocked module instance
  const __modal = { getOpen: () => open, openModal, closeModal }
  return { useModalStore, __modal }
})

// Chat mode store (activeMode undefined to trigger gate)
vi.mock('@store/chatModeStore', () => {
  const state: any = {
    activeMode: undefined,
    lockedByProp: false,
    resetMode: vi.fn(() => { state.activeMode = undefined }),
  }
  function useChatModeStore() { return state }
  ;(useChatModeStore as any).getState = () => state
  ;(useChatModeStore as any).setState = (patch: any) => Object.assign(state, patch)
  return { useChatModeStore }
})

// Wagmi hooks minimal
vi.mock('wagmi', () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useChainId: () => undefined,
  useEnsName: () => ({ data: undefined }),
}))

// Public config/env (only what's used)
vi.mock('@config/public.env', () => ({
  publicEnv: {
    NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME: 'RitoNet',
  },
}))

// AI public config: require JWT & custom API path
vi.mock('@config/ai.public', () => ({
  aiPublicConfig: Object.freeze({
    requiresJwt: true,
    apiPath: '/api/chat',
  }),
}))

// Client token getter returns a stable token
vi.mock('@lib/jwt/client', () => ({
  getStoredToken: vi.fn(() => 'tok-abcdef123456'),
}))

// Compose helpers return deterministic strings
vi.mock('@lib/llm/modes/composePrompt', () => ({
  composeSystemPrompt: vi.fn(() => '<<SYSTEM_PROMPT>>'),
}))
vi.mock('@lib/llm/modes/composeWelcome', () => ({
  composeWelcomeMessage: vi.fn(() => 'Welcome!'),
}))

// Music provider & hook: stub to avoid audio/env complexity
vi.mock('../MusicPlayer/MusicProvider', () => {
  const useMusic = () => ({ unlock: vi.fn(), reset: vi.fn() })
  const MusicProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>
  return { MusicProvider, useMusic }
})

// Child components: keep trivial
vi.mock('../ChatContainer', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="chat-container">{children}</div>,
}))
vi.mock('../ChatHeader', () => ({
  default: () => <div data-testid="chat-header" />,
}))
vi.mock('../ChatMessages/ChatMessages', () => {
  const React = require('react')
  const ChatMessages = React.forwardRef((_props: any, _ref: any) => <div data-testid="chat-messages" />)
  return { default: ChatMessages }
})
vi.mock('../ChatForm', () => ({
  default: (_props: any) => <div data-testid="chat-form" />,
}))
vi.mock('../MusicPlayer/MusicBar', () => ({
  default: () => <div data-testid="music-bar" />,
}))
vi.mock('../modals/ModeSelectModal', () => ({
  ModeSelectModal: () => <div data-testid="mode-select-modal" />,
}))
vi.mock('../modals/ErrorModal', () => ({
  ErrorModal: () => <div data-testid="error-modal" />,
}))
vi.mock('../forms', () => ({
  BattleFormModal: () => <div data-testid="battle-form-modal" />,
}))
vi.mock('../modals/ConfirmResetModal', () => ({
  ConfirmResetModal: (_: { onConfirm: () => void }) => <div data-testid="confirm-reset-modal" />,
}))

// Create transport: capture last args so we can assert headers/metadata
vi.mock('@/app/lib/llm/client/ToolAwareTransport', () => {
  let lastArgs: any
  return {
    createToolAwareTransport: (args: any) => {
      lastArgs = args
      // the real transport object shape isn't used by our mocked useChat
      return { kind: 'mock-transport' }
    },
    __getLastArgs: () => lastArgs,
  }
})

// useChat: no network; stable ready state & spies for calls
const chatSpies = {
  sendMessage: vi.fn(),
  stop: vi.fn(),
  regenerate: vi.fn(),
  setMessages: vi.fn(),
}
vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    id: 'test-chat',
    messages: [],
    status: 'ready',
    error: null,
    ...chatSpies,
  }),
}))

// ----------- SUT -----------
import ChatBot from '../index'

// ----------- Tests -----------

describe('ChatBot (integration smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens the ModeSelect modal when no active mode is set', async () => {
    render(<ChatBot />)
    const modalMod: any = await import('@store/modalStore')
    await waitFor(() => {
      expect(modalMod.__modal.getOpen()).toBe('mode')
    })
  })

  it('creates transport with Authorization header when requiresJwt=true and token exists', async () => {
    render(<ChatBot />)
    const transportMod: any = await import('@/app/lib/llm/client/ToolAwareTransport')
    await waitFor(() => {
      const last = transportMod.__getLastArgs()
      expect(last).toBeTruthy()
      expect(last.api).toBe('/api/chat')
      expect(last.headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: 'Bearer tok-abcdef123456',
      })
      // getMetadata should be a function
      expect(typeof last.getMetadata).toBe('function')
      const meta = last.getMetadata()
      // When no mode is set in the mock store, ChatBot defaults metadata to "choose"
      expect(meta).toMatchObject({ mode: 'choose' })
    })
  })
})
