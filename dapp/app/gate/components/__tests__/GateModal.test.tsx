// dapp/app/gate/components/__tests__/GateModal.test.tsx
import React from 'react'
import { render, screen, act, fireEvent } from '@testing-library/react'
import * as wagmi from 'wagmi'
import * as siweClient from '@/app/lib/siwe/siwe.client'
import { useNFTStore } from '@/app/store/nftStore'
import { showRateLimitModal } from '@/components/utilities/rateLimitModal/RateLimitModal'

// ──────────────────────────────────────────────────────────────
// Hoisted Mocks
// ──────────────────────────────────────────────────────────────
vi.mock('wagmi')
vi.mock('@/app/lib/siwe/siwe.client')
vi.mock('@/app/store/nftStore')
vi.mock('@/components/utilities/rateLimitModal/RateLimitModal')
vi.mock('@/components/providers/DappChainProvider', () => ({
  useDappChain: () => ({
    dappChainId: 1,
    setDappChainId: vi.fn(),
    resetToActiveChain: vi.fn(),
    isOnActiveChain: true,
  }),
}))

// Notifications facade used by GateModal
vi.mock('@/app/lib/notifications', () => ({
  sendNotificationEvent: vi.fn(),
  sendErrorNotification: vi.fn(),
}))

// public env
vi.mock('@config/public.env', () => ({
  publicEnv: {
    NEXT_PUBLIC_DOMAIN: 'localhost',
  },
}))

// network hook so we don't actually switch chains
vi.mock('@/app/hooks/useNetworkCheck', () => ({
  __esModule: true,
  useNetworkCheck: () => ({
    ensureCorrectNetwork: vi.fn(async () => true),
    targetChainId: 1,
  }),
}))

// Connect wrapper stub
vi.mock('@/components/wallet/connectButton/ConnectWrapper', () => ({
  __esModule: true,
  default: () => <button data-testid="connect-mock">Connect</button>,
}))

// ✅ JWT client (isomorphic) — Fixed function names to match component
const mockGetStoredToken = vi.fn(() => null as string | null)
const mockIsExpired = vi.fn((token: string) => false)
vi.mock('@/app/lib/jwt/client', () => ({
  __esModule: true,
  getStoredToken: () => mockGetStoredToken(),
  isExpired: (t: string) => mockIsExpired(t),
  setStoredToken: vi.fn(),
  clearStoredToken: vi.fn(),
}))

// ✅ Minimal client API facade used by GateModal
const mockGateRequest = vi.fn(
  async (payload: any, options: { signal: AbortSignal }) => {
    return { ok: false, status: 500, error: 'Not mocked' } as any
  }
)
const mockFetchNonce = vi.fn(async () => ({ ok: false } as any))
const mockNormalize = vi.fn((s: string) => s)
const mockHasRateLimitInfo = vi.fn((arg: any) => false)
const mockIsErrorResponse = vi.fn((arg: any) => false)

vi.mock('@/app/lib/client', () => ({
  __esModule: true,
  gateApi: {
    requestGateAccess: (payload: any, options: { signal: AbortSignal }) =>
      mockGateRequest(payload, options),
  },
  nonceApi: { fetchNonce: () => mockFetchNonce() },
  normalizeHost: (s: string) => mockNormalize(s),
  hasRateLimitInfo: (arg: any) => mockHasRateLimitInfo(arg),
  isErrorResponse: (arg: any) => mockIsErrorResponse(arg),
}))

// Mock fetch using vi.stubGlobal
const mockFetch = vi.fn()

// Import AFTER mocks
import GateModal from '../GateModal/GateModal'

// ──────────────────────────────────────────────────────────────
describe('GateModal', () => {
  let originalRaf: typeof window.requestAnimationFrame
  let originalCaf: typeof window.cancelAnimationFrame
  const prevEnv = process.env.NEXT_PUBLIC_DOMAIN

  beforeEach(() => {
    vi.useFakeTimers()

    // Setup fetch mock
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()

    // Make rAF immediate so focus effect runs synchronously
    originalRaf = window.requestAnimationFrame
    originalCaf = window.cancelAnimationFrame
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0)
      return 1 as any
    }) as any
    window.cancelAnimationFrame = (() => {}) as any

    process.env.NEXT_PUBLIC_DOMAIN = 'localhost'

    // Defaults
    ;(useNFTStore as any).mockReturnValue({
      hasNFT: false,
      hasUsedTokenGate: false,
      isLoading: false,
      tokenId: 1,
    })
    ;(wagmi.useAccount as any).mockReturnValue({
      isConnected: false,
      address: null,
      connector: { id: 'injected' },
      status: 'disconnected',
    })
    ;(wagmi.useSignMessage as any).mockReturnValue({
      signMessageAsync: vi.fn(),
    })

    ;(siweClient.isSiweEnabled as any).mockReturnValue(false)

    // JWT/client API defaults
    mockGetStoredToken.mockReset()
    mockGetStoredToken.mockReturnValue(null)
    mockIsExpired.mockReset()
    mockIsExpired.mockReturnValue(false)
    mockGateRequest.mockReset()
    mockFetchNonce.mockReset()
    mockNormalize.mockImplementation((s: string) => s)
    mockHasRateLimitInfo.mockReset()
    mockIsErrorResponse.mockReset()
  })

  afterEach(() => {
    vi.runAllTimers()
    vi.useRealTimers()
    window.requestAnimationFrame = originalRaf
    window.cancelAnimationFrame = originalCaf
    vi.resetAllMocks()
    vi.unstubAllGlobals()
    process.env.NEXT_PUBLIC_DOMAIN = prevEnv
  })

  it('stays "Loading…" during connecting/grace and then shows "You are not signed in"', () => {
    ;(wagmi.useAccount as any).mockReturnValue({
      isConnected: false,
      address: null,
      connector: { id: 'injected' },
      status: 'connecting',
    })

    const utils = render(<GateModal onUnlock={vi.fn()} isAnimating={false} />)

    expect(screen.getByRole('heading')).toHaveTextContent('Loading...')
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true')

    act(() => vi.advanceTimersByTime(50))

    ;(wagmi.useAccount as any).mockReturnValue({
      isConnected: false,
      address: null,
      connector: { id: 'injected' },
      status: 'disconnected',
    })
    act(() => {
      utils.rerender(<GateModal onUnlock={vi.fn()} isAnimating={false} />)
    })

    act(() => vi.advanceTimersByTime(800))

    expect(screen.getByRole('heading')).toHaveTextContent('You are not signed in')
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-busy', 'true')
  })

  it('shows "Access Restricted" with a Get Key link when connected but has no NFT', () => {
    ;(wagmi.useAccount as any).mockReturnValue({
      isConnected: true,
      address: '0x123',
      connector: { id: 'injected' },
      status: 'connected',
    })
    ;(useNFTStore as any).mockReturnValue({
      hasNFT: false,
      hasUsedTokenGate: false,
      isLoading: false,
      tokenId: 1,
    })

    act(() => {
      render(<GateModal onUnlock={vi.fn()} isAnimating={false} />)
    })
    act(() => vi.advanceTimersByTime(50))

    expect(screen.getByRole('heading')).toHaveTextContent(
      'Access Restricted. You need a key to enter.'
    )
    const getKeyLink = screen.getByRole('link', {
      name: /Get an access key to enter the token gate/i,
    })
    expect(getKeyLink).toHaveAttribute('href', '/mint')
    expect(getKeyLink).toHaveTextContent('Get Key')
  })

  it('renders the "Sign & Unlock" button when user has an unused NFT', () => {
    ;(wagmi.useAccount as any).mockReturnValue({
      isConnected: true,
      address: '0x123',
      connector: { id: 'injected' },
      status: 'connected',
    })
    ;(useNFTStore as any).mockReturnValue({
      hasNFT: true,
      hasUsedTokenGate: false,
      isLoading: false,
      tokenId: 99,
    })

    act(() => {
      render(<GateModal onUnlock={vi.fn()} isAnimating={false} />)
    })
    act(() => vi.advanceTimersByTime(50))

    expect(screen.getByRole('heading')).toHaveTextContent(
      'Welcome to the RitoSwap Token Gate'
    )
    expect(screen.queryByRole('alert')).toBeNull()

    const btn = screen.getByRole('button', {
      name: /Sign message to unlock the token gate/i,
    })
    expect(btn).toBeEnabled()
    expect(btn).toHaveTextContent('Sign & Unlock')
    expect(btn).toHaveAttribute('aria-busy', 'false')
  })

  it('shows "already used" message with a Get New Key link when user has used their NFT', () => {
    ;(wagmi.useAccount as any).mockReturnValue({
      isConnected: true,
      address: '0x123',
      connector: { id: 'injected' },
      status: 'connected',
    })
    ;(useNFTStore as any).mockReturnValue({
      hasNFT: true,
      hasUsedTokenGate: true,
      isLoading: false,
      tokenId: 99,
    })

    act(() => {
      render(<GateModal onUnlock={vi.fn()} isAnimating={false} />)
    })
    act(() => vi.advanceTimersByTime(50))

    expect(screen.getByRole('heading')).toHaveTextContent(
      'Your key has already been used. Please burn it and get a new one to unlock this area.'
    )
    const newKeyLink = screen.getByRole('link', {
      name: /Get a new access key to replace your used key/i,
    })
    expect(newKeyLink).toHaveAttribute('href', '/mint')
    expect(newKeyLink).toHaveTextContent('Get New Key')
  })

  it('focuses the first focusable element when the no-NFT panel renders', () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus')

    ;(wagmi.useAccount as any).mockReturnValue({
      isConnected: true,
      address: '0x123',
      connector: { id: 'injected' },
      status: 'connected',
    })
    ;(useNFTStore as any).mockReturnValue({
      hasNFT: false,
      hasUsedTokenGate: false,
      isLoading: false,
      tokenId: 1,
    })

    act(() => {
      render(<GateModal onUnlock={vi.fn()} isAnimating={false} />)
    })
    act(() => vi.advanceTimersByTime(50))

    expect(focusSpy).toHaveBeenCalledTimes(2)
    focusSpy.mockRestore()
  })

  it('disables the button and shows ProcessingModal when "Sign & Unlock" is clicked', () => {
    ;(wagmi.useAccount as any).mockReturnValue({
      isConnected: true,
      address: '0xABC',
      connector: { id: 'injected' },
      status: 'connected',
    })
    ;(useNFTStore as any).mockReturnValue({
      hasNFT: true,
      hasUsedTokenGate: false,
      isLoading: false,
      tokenId: 55,
    })
    const neverResolve = new Promise<void>(() => {})
    ;(wagmi.useSignMessage as any).mockReturnValue({
      signMessageAsync: vi.fn(() => neverResolve),
    })

    act(() => {
      render(<GateModal onUnlock={vi.fn()} isAnimating={false} />)
    })
    act(() => vi.advanceTimersByTime(50))

    const btn = screen.getByRole('button', {
      name: /Sign message to unlock the token gate/i,
    })

    act(() => {
      fireEvent.click(btn)
    })

    // 🔧 Flush ProcessingModal's internal setTimeout(…, 0) + showTimer(50)
    act(() => {
      vi.runOnlyPendingTimers()
    })

    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent('Signing...')
    expect(btn).toHaveAttribute('aria-label', 'Signing in progress')
    expect(btn).toHaveAttribute('aria-busy', 'true')

    const procDialog = screen.getByRole('dialog', { name: /Processing/i })
    expect(procDialog).toBeInTheDocument()
  })

  // ──────────────────────────────────────────────────────────────
  // NEW: JWT flow tests
  // ──────────────────────────────────────────────────────────────

  it('JWT path: uses cached token to unlock without signing', async () => {
    const onUnlock = vi.fn()
    ;(wagmi.useAccount as any).mockReturnValue({
      isConnected: true,
      address: '0xabcDEFabcDEFabcDEFabcDEFabcDEFabcDEFabcd',
      connector: { id: 'injected' },
      status: 'connected',
    })
    ;(useNFTStore as any).mockReturnValue({
      hasNFT: true,
      hasUsedTokenGate: false,
      isLoading: false,
      tokenId: 99,
    })

    const signSpy = vi.fn()
    ;(wagmi.useSignMessage as any).mockReturnValue({
      signMessageAsync: signSpy,
    })

    // Pretend we have a valid stored token
    mockGetStoredToken.mockReturnValue('valid.jwt')
    mockIsExpired.mockReturnValue(false)

    // Mock the fetch call for JWT path
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        success: true,
        access: 'granted',
        content: {
          welcomeText: 'hi',
          textSubmissionAreaHtml: '<div></div>',
          audioData: {
            headline: 'h',
            imageSrc: '/a.png',
            imageAlt: 'alt',
            description: 'd',
            title: 't',
            audioSrc: '/a.mp3',
          },
          styles: '',
          script: '',
        },
      }),
    })

    render(<GateModal onUnlock={onUnlock} isAnimating={false} />)
    act(() => vi.advanceTimersByTime(50))

    const btn = screen.getByRole('button', {
      name: /Sign message to unlock the token gate/i,
    })

    await act(async () => {
      fireEvent.click(btn)
      // let the internal async flow settle
      await Promise.resolve()
    })

    // should NOT sign when JWT is valid
    expect(signSpy).not.toHaveBeenCalled()

    // should call fetch API with Authorization header
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/gate-access',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid.jwt',
        }),
        body: JSON.stringify({ tokenId: 99 }),
      })
    )

    // onUnlock fired
    expect(onUnlock).toHaveBeenCalledTimes(1)
  })

  it('JWT path: falls back to legacy signing when JWT missing or expired', async () => {
    const onUnlock = vi.fn()
    ;(siweClient.isSiweEnabled as any).mockReturnValue(false) // legacy mode
    ;(wagmi.useAccount as any).mockReturnValue({
      isConnected: true,
      address: '0xF00',
      connector: { id: 'injected' },
      status: 'connected',
    })
    ;(useNFTStore as any).mockReturnValue({
      hasNFT: true,
      hasUsedTokenGate: false,
      isLoading: false,
      tokenId: 55,
    })

    const signSpy = vi.fn(async () => '0x' + 'a'.repeat(130))
    ;(wagmi.useSignMessage as any).mockReturnValue({
      signMessageAsync: signSpy,
    })

    // Simulate: JWT present but expired → should fall back
    mockGetStoredToken.mockReturnValue('expired.jwt')
    mockIsExpired.mockReturnValue(true) // token is expired

    // Mock the legacy gate request to succeed
    mockGateRequest.mockResolvedValue({
      ok: true,
      data: {
        success: true,
        access: 'granted',
        content: {
          welcomeText: 'hi',
          textSubmissionAreaHtml: '<div></div>',
          audioData: {
            headline: 'h',
            imageSrc: '/a.png',
            imageAlt: 'alt',
            description: 'd',
            title: 't',
            audioSrc: '/a.mp3',
          },
          styles: '',
          script: '',
        },
        accessToken: 'new.jwt',
      },
    })

    render(<GateModal onUnlock={onUnlock} isAnimating={false} />)
    act(() => vi.advanceTimersByTime(50))

    const btn = screen.getByRole('button', {
      name: /Sign message to unlock the token gate/i,
    })

    await act(async () => {
      fireEvent.click(btn)
      await Promise.resolve()
    })

    // should sign in legacy path
    expect(signSpy).toHaveBeenCalledTimes(1)
    // and call gate API
    expect(mockGateRequest).toHaveBeenCalledTimes(1)
    const [payload] = mockGateRequest.mock.calls[0]
    expect(payload).toHaveProperty('address')
    expect(payload).toHaveProperty('signature')
    expect(payload).toHaveProperty('timestamp')
    expect(payload).toHaveProperty('tokenId', 55)

    expect(onUnlock).toHaveBeenCalledTimes(1)
  })
})
