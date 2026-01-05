// dapp/components/chatBot/ChatMessages/__tests__/ChatMessages.test.tsx
import React, { createRef } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import ChatMessages, { type ChatMessagesHandle } from '../ChatMessages'
import type { ChatMessagesProps } from '../types'

vi.mock('../ChatMessages.module.css', () => ({
  default: {
    messagesContainer: 'messagesContainer',
    messagesContainerShrunk: 'messagesContainerShrunk',
    message: 'message',
    userMessage: 'userMessage',
    assistantMessage: 'assistantMessage',
    messageContent: 'messageContent',
    loadingContainer: 'loadingContainer',
    loadingDots: 'loadingDots',
    loadingText: 'loadingText',
    errorMessage: 'errorMessage',
    retryButton: 'retryButton',
  },
}))

vi.mock('../MessageContent', () => ({
  __esModule: true,
  default: () => <div data-testid="message-content" />,
}))

vi.mock('../components/WagmiBoundary', () => ({
  __esModule: true,
  default: ({ children, fallback }: any) => (
    <div data-testid="wagmi-boundary">{children ?? fallback}</div>
  ),
}))

vi.mock('../components/UserHeader/UserHeaderWithWagmi', () => ({
  __esModule: true,
  default: () => <div data-testid="user-header" />,
}))

vi.mock('../components/UserHeader/UserHeaderFallback', () => ({
  __esModule: true,
  default: () => <div data-testid="user-header-fallback" />,
}))

vi.mock('../components/AssistantHeader', () => ({
  __esModule: true,
  default: () => <div data-testid="assistant-header" />,
}))

vi.mock('../components/AssistantAudioButton', () => ({
  __esModule: true,
  default: () => null,
}))

vi.mock('../../ToolActivity/ToolActivityRow', () => ({
  __esModule: true,
  default: () => <div data-testid="tool-activity-row" />,
}))

const { useToolActivityStoreMock } = vi.hoisted(() => ({
  useToolActivityStoreMock: vi.fn((selector: any) => selector({ anchors: {} })),
}))
vi.mock('@store/toolActivity', () => ({
  useToolActivityStore: useToolActivityStoreMock,
}))

vi.mock('../utils/splitPartsAtAnchor', () => ({
  splitPartsAtAnchor: (parts: any) => ({ before: parts ?? [], after: [] }),
}))

const baseProps: ChatMessagesProps = {
  messages: [
    { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
    { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'yo' }] },
  ],
  isLoading: false,
  status: 'success',
  error: null,
  onRegenerate: vi.fn(),
  textareaExpanded: false,
}

describe('ChatMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders messages and loading state', () => {
    const { container } = render(
      <ChatMessages {...baseProps} isLoading={true} />
    )

    expect(
      screen.getByText('RapBotRito is cooking up bars...')
    ).toBeInTheDocument()
    expect(container.querySelectorAll('[data-role="user"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-role="assistant"]')).toHaveLength(1)
  })

  it('shows error UI and calls onRegenerate', () => {
    const onRegenerate = vi.fn()
    render(
      <ChatMessages
        {...baseProps}
        status="error"
        error={{ message: 'Nope' }}
        onRegenerate={onRegenerate}
      />
    )

    expect(screen.getByText('Error:')).toBeInTheDocument()
    expect(screen.getByText('Nope')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRegenerate).toHaveBeenCalledTimes(1)
  })

  it('exposes imperative handle to jump to bottom', () => {
    const ref = createRef<ChatMessagesHandle>()
    const { container } = render(<ChatMessages {...baseProps} ref={ref} />)

    const el = container.querySelector('.messagesContainer') as HTMLDivElement
    Object.defineProperty(el, 'scrollHeight', { value: 500, configurable: true })
    el.scrollTop = 10

    ref.current?.jumpToBottomAndPin()

    expect(el.scrollTop).toBe(500)
  })

  it('jumps to bottom when no user messages exist', () => {
    const ref = createRef<ChatMessagesHandle>()
    const { container } = render(
      <ChatMessages
        {...baseProps}
        messages={[{ id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'yo' }] }]}
        ref={ref}
      />
    )

    const el = container.querySelector('.messagesContainer') as HTMLDivElement
    Object.defineProperty(el, 'scrollHeight', { value: 700, configurable: true })
    el.scrollTop = 0

    ref.current?.jumpToLatestUserMessageBottomAndPin()

    expect(el.scrollTop).toBe(700)
  })
})
