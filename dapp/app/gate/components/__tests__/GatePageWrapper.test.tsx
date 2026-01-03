// app/gate/components/__tests__/GatePageWrapper.test.tsx
import React from 'react'
import { render, screen, act, fireEvent } from '@testing-library/react'

// ──────────────────────────────────────────────────────────────────────────────
// Mocks (hoisted)
// ──────────────────────────────────────────────────────────────────────────────
vi.mock('wagmi', () => ({
  __esModule: true,
  useAccount: () => ({ address: '0xabc', isConnected: true, connector: { id: 'injected' } }),
  useSignMessage: () => ({ signMessageAsync: vi.fn(async () => '0xsigned') }),
  useChainId: () => 1,
}))

vi.mock('@/components/providers/DappChainProvider', () => ({
  __esModule: true,
  useDappChain: () => ({
    dappChainId: 1,
    setDappChainId: vi.fn(),
    resetToActiveChain: vi.fn(),
    isOnActiveChain: true,
  }),
}))

vi.mock('@/app/store/nftStore', () => ({
  __esModule: true,
  useNFTStore: () => ({
    setCurrentAddress: vi.fn(),
    resetState: vi.fn(),
    currentAddress: '0xabc',
    startAccountSwitch: vi.fn(),
    completeAccountSwitch: vi.fn(),
    isSwitchingAccount: false,
    tokenId: 42,
    setHasUsedTokenGate: vi.fn(),
  }),
}))

vi.mock('@/app/hooks/useNFTData', () => ({
  __esModule: true,
  // accept the isAuthenticated flag but ignore it in the mock
  useNFTData: (_isAuthenticated?: boolean) => ({ forceRefresh: vi.fn() }),
}))

vi.mock('@/app/utils/mobile', () => ({
  __esModule: true,
  isMobileDevice: () => false,
}))

// network hook so we don't actually switch chains
vi.mock('@hooks/useNetworkCheck', () => ({
  __esModule: true,
  useNetworkCheck: () => ({
    ensureCorrectNetwork: vi.fn(async () => true),
    targetChainId: 1,
  }),
}))

// ✅ Mock the new notifications facade used by GatePageWrapper
vi.mock('@/app/lib/notifications', () => ({
  __esModule: true,
  sendNotificationEvent: vi.fn(),
  sendErrorNotification: vi.fn(),
  sendNotification: vi.fn(),
  sendSuccessNotification: vi.fn(),
  sendInfoNotification: vi.fn(),
  sendLoadingNotification: vi.fn(() => 'toast-id'),
  dismissLoadingNotification: vi.fn(),
  notifications: {
    clearHistory: vi.fn(),
    setDefaultChannels: vi.fn(),
    getHistory: vi.fn(() => []),
  },
}))

vi.mock('@/components/utilities/rateLimitModal/RateLimitModal', () => ({
  __esModule: true,
  showRateLimitModal: vi.fn(),
}))

// Keep ProcessingModal simple/visible
vi.mock('@/components/wallet/processingModal/ProcessingModal', () => ({
  __esModule: true,
  default: ({ isVisible }: { isVisible: boolean }) =>
    isVisible ? <div role="dialog" aria-label="Processing signature request" /> : null,
}))

// Mock child: GateModal – provides a button that triggers unlock + supplies content
const fakeContent = {
  welcomeText: 'hi',
  textSubmissionAreaHtml: '<div id="stub">stub</div>',
  audioData: {
    headline: 'h',
    imageSrc: '/img.png',
    imageAlt: 'alt',
    description: 'd',
    title: 't',
    audioSrc: '/a.mp3',
  },
  styles: '',
  script: '/* noop */',
} as any

vi.mock('../GateModal/GateModal', () => ({
  __esModule: true,
  default: ({ onUnlock, onContentReceived }: any) => (
    <div data-testid="gate-modal">
      <button
        onClick={() => {
          onContentReceived?.(fakeContent)
          onUnlock?.()
        }}
      >
        unlock-now
      </button>
    </div>
  ),
}))

// Mock child: GatedContentRenderer – renders a submit button that calls onSubmit
vi.mock('../GatedContentRenderer/GatedContentRenderer', () => ({
  __esModule: true,
  default: ({ onSubmit }: { onSubmit: (text: string) => Promise<void> }) => (
    <div data-testid="gated-renderer">
      <button onClick={() => onSubmit('hello world')}>submit-message</button>
    </div>
  ),
}))

// Mock client lib used by GatePageWrapper
const submitFormMock = vi.fn()
const fetchTokenStatusMock = vi.fn()
vi.mock('@/app/lib/client', () => ({
  __esModule: true,
  formApi: { submitForm: (...args: any[]) => submitFormMock(...args) },
  tokenStatusApi: { fetchTokenStatus: (...args: any[]) => fetchTokenStatusMock(...args) },
  buildEnvelope: () => ({
    domain: 'localhost',
    path: '/api/form-submission-gate',
    method: 'POST' as const,
    timestamp: 111_555_999,
  }),
  buildBoundMessage: ({ tokenId, chainId }: any) =>
    `I own key #${tokenId}\nChainId: ${chainId}\nTimestamp: 111555999`,
  hasRateLimitInfo: () => false,
  isErrorResponse: () => false,
}))

// Import after mocks
import GatePageWrapper from '../GatePageWrapper'

// Small helper to flush microtasks
const flushPromises = () => new Promise<void>((r) => queueMicrotask(() => r()))

describe('GatePageWrapper', () => {
  let originalNow: any

  beforeEach(() => {
    vi.useFakeTimers()
    submitFormMock.mockReset()
    fetchTokenStatusMock.mockReset()
    originalNow = Date.now
    Date.now = () => 111_555_999
  })

  afterEach(() => {
    // drain timers/microtasks so tests don't leak
    act(() => {
      try {
        vi.runOnlyPendingTimers()
      } catch {}
    })
    vi.useRealTimers()
    Date.now = originalNow
  })

  it('mounts modal, unlocks, then mounts content after delays', () => {
    render(<GatePageWrapper />)

    // Gate modal present
    expect(screen.getByTestId('gate-modal')).toBeInTheDocument()

    // Unlock → schedules 2000ms + 50ms chain to mount content
    fireEvent.click(screen.getByText('unlock-now'))
    act(() => {
      vi.advanceTimersByTime(2050)
    })

    // Renderer now visible
    expect(screen.getByTestId('gated-renderer')).toBeInTheDocument()
  })

  it('submits via renderer onSubmit → calls formApi.submitForm with string tokenId and shows processing', async () => {
    // Keep submit pending so we can see the processing dialog
    let resolveSubmit!: (v: any) => void
    submitFormMock.mockImplementation(
      () =>
        new Promise((res) => {
          resolveSubmit = res
        })
    )
    fetchTokenStatusMock.mockResolvedValue({ ok: true, status: 200, data: {} })

    render(<GatePageWrapper />)

    // Unlock & mount content
    fireEvent.click(screen.getByText('unlock-now'))
    act(() => vi.advanceTimersByTime(2050))

    // Click "submit" inside renderer → triggers handleGatedSubmission
    fireEvent.click(screen.getByText('submit-message'))
    await act(async () => {
      await flushPromises() // let signMessageAsync + submit call run
    })

    // Submit called once with tokenId as STRING per DTO
    expect(submitFormMock).toHaveBeenCalledTimes(1)
    const [payload] = submitFormMock.mock.calls[0]
    expect(payload).toMatchObject({
      tokenId: '42',
      message: 'hello world',
      address: '0xabc',
      timestamp: expect.any(Number),
    })

    // Processing dialog visible while pending
    expect(
      screen.getByRole('dialog', { name: /Processing signature request/i })
    ).toBeInTheDocument()

    // Resolve submit → component should finish and hide dialog
    await act(async () => {
      resolveSubmit({
        ok: true,
        status: 200,
        data: { success: true, message: 'Access granted' },
        headers: new Headers(),
      })
      await flushPromises()
    })

    // Now timers for completion sequence will run later; dialog should be gone immediately after
    expect(
      screen.queryByRole('dialog', { name: /Processing signature request/i })
    ).not.toBeInTheDocument()
  })

  it('runs the full completion sequence and unmounts the renderer', async () => {
    submitFormMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { success: true, message: 'Access granted' },
      headers: new Headers(),
    })
    fetchTokenStatusMock.mockResolvedValue({ ok: true, status: 200, data: {} })

    render(<GatePageWrapper />)

    // Unlock & mount content
    fireEvent.click(screen.getByText('unlock-now'))
    act(() => vi.advanceTimersByTime(2050))
    expect(screen.getByTestId('gated-renderer')).toBeInTheDocument()

    // Submit → success
    fireEvent.click(screen.getByText('submit-message'))
    await act(async () => {
      await flushPromises() // resolve submit promise chain
    })

    // Step 1: after 2000ms, content unmounts
    act(() => vi.advanceTimersByTime(2000))
    expect(screen.queryByTestId('gated-renderer')).not.toBeInTheDocument()

    // Step 2: +50ms show completion
    act(() => vi.advanceTimersByTime(50))

    // Step 3: +4000ms hide completion
    act(() => vi.advanceTimersByTime(4000))

    // Step 4: +2000ms reset everything
    act(() => vi.advanceTimersByTime(2000))

    // Nothing crashes, renderer stays unmounted
    expect(screen.queryByTestId('gated-renderer')).not.toBeInTheDocument()
  })
})
