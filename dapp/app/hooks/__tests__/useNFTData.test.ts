// FILE: app/hooks/__tests__/useNFTData.test.ts
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { useNFTData } from '../useNFTData'

// 1️⃣ Mock wagmi hooks
const useAccountMock      = vi.fn()
const useReadContractMock = vi.fn()
vi.mock('wagmi', () => ({
  useAccount:      () => useAccountMock(),
  useReadContract: (opts: any) => useReadContractMock(opts),
}))

// 2️⃣ Mock chainConfig (both old and new import paths for safety)
vi.mock('@/app/utils/chainConfig', () => ({
  getTargetChainId: vi.fn(() => 1),
}))
vi.mock('@config/chain', () => ({
  getTargetChainId: vi.fn(() => 1),
}))

// 3️⃣ Mock contracts (both old and new import paths for safety)
vi.mock('@/app/config/contracts', () => ({
  KEY_TOKEN_ADDRESS: '0x123',
  fullKeyTokenAbi:   [],
}))
vi.mock('@config/contracts', () => ({
  KEY_TOKEN_ADDRESS: '0x123',
  fullKeyTokenAbi:   [],
}))

// 4️⃣ Mock the NFT store
const setHasNFT             = vi.fn()
const setTokenData          = vi.fn()
const setLoading            = vi.fn()
const setHasUsedTokenGate   = vi.fn()
const startAccountSwitch    = vi.fn(() => { storeState.isSwitchingAccount = true })
const completeAccountSwitch = vi.fn(() => { storeState.isSwitchingAccount = false })
let storeState = {
  hasNFT: false,
  tokenId: null as number | null,
  isSwitchingAccount: false,
}
vi.mock('@/app/store/nftStore', () => ({
  useNFTStore() {
    return {
      ...storeState,
      setHasNFT,
      setTokenData,
      setLoading,
      setHasUsedTokenGate,
      startAccountSwitch,
      completeAccountSwitch,
    }
  },
}))

describe('useNFTData – timing, switching, polling, and state updates', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    // Create a new QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    })

    vi.clearAllMocks()
    // default: no address
    useAccountMock.mockReturnValue({ address: null, isConnected: false })
    // default: no on-chain data
    useReadContractMock.mockReturnValue({
      data:         undefined,
      refetch:      vi.fn().mockResolvedValue({ data: undefined }),
      isLoading:    false,
      isRefetching: false,
    })
    // ✅ stub global fetch for usage endpoint WITH `exists`
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({
        ok:   true,
        json: () => Promise.resolve({ exists: true, used: true, count: 1 }),
      })
    ))

    // reset store
    storeState = { hasNFT: false, tokenId: null, isSwitchingAccount: false }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    queryClient.clear()
  })

  // Helper to wrap renderHook with QueryClientProvider
  const renderHookWithQuery = (hook: () => any) => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
    return renderHook(hook, { wrapper })
  }

  it('when user has a token → refetches, sets tokenData & usage, toggles loading', async () => {
    vi.useRealTimers()

    // simulate connected
    useAccountMock.mockReturnValue({ address: '0xABC', isConnected: true })

    // Mock state that changes after refetch
    let tokenData: any = undefined
    let colorData: any = undefined

    const refetchToken = vi.fn().mockImplementation(async () => {
      tokenData = [42, true]
      return { data: [42, true] }
    })
    
    const refetchColors = vi.fn().mockImplementation(async () => {
      colorData = ['bg', 'key']
      return { data: ['bg', 'key'] }
    })
    
    useReadContractMock.mockImplementation((config: any) => {
      if (config.functionName === 'getTokenOfOwner') {
        return {
          data:         tokenData,
          refetch:      refetchToken,
          isLoading:    false,
          isRefetching: false,
        }
      } else if (config.functionName === 'getTokenColors') {
        return {
          data:      colorData,
          refetch:   refetchColors,
          isLoading: false,
        }
      }
      return {
        data:         undefined,
        refetch:      vi.fn(),
        isLoading:    false,
        isRefetching: false,
      }
    })

    const { result } = renderHookWithQuery(() => useNFTData())

    // trigger forceRefresh
    await act(async () => {
      await result.current.forceRefresh()
    })

    // wait for the useEffect that sets hasUsedTokenGate (exists: true, used: true)
    await waitFor(() => {
      expect(setHasUsedTokenGate).toHaveBeenCalledWith(true)
    })

    // other assertions
    expect(refetchToken).toHaveBeenCalled()
    expect(refetchColors).toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledWith('/api/token-status/42')
    expect(setTokenData).toHaveBeenCalledWith(42, 'bg', 'key')
    expect(setHasNFT).toHaveBeenCalledWith(true)
    expect(completeAccountSwitch).not.toHaveBeenCalled()
    expect(setLoading).toHaveBeenCalledWith(true)
    expect(setLoading).toHaveBeenLastCalledWith(false)
  })

  it('when user has NO token → clears store & loading flags', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    useAccountMock.mockReturnValue({ address: '0xABC', isConnected: true })

    const refetchToken = vi.fn().mockResolvedValue({ data: [0, false] })
    useReadContractMock.mockImplementation(() => ({
      data:         [0, false],
      refetch:      refetchToken,
      isLoading:    false,
      isRefetching: false,
    }))

    const { result } = renderHookWithQuery(() => useNFTData())
    
    await act(async () => {
      const p = result.current.forceRefresh()
      vi.advanceTimersByTime(1000)
      await p
    })

    expect(refetchToken).toHaveBeenCalled()
    expect(setTokenData).toHaveBeenCalledWith(null, null, null)
    expect(setHasNFT).toHaveBeenCalledWith(false)
    expect(setHasUsedTokenGate).toHaveBeenCalledWith(false)
    expect(setLoading).toHaveBeenLastCalledWith(false)
  })

  it('when switching account → uses 500ms delay & completes switch (via forceRefresh)', async () => {
    vi.useFakeTimers()
    storeState.isSwitchingAccount = true
    useAccountMock.mockReturnValue({ address: '0xDEF', isConnected: true })

    const refetchToken  = vi.fn().mockResolvedValue({ data: [7, true] })
    const refetchColors = vi.fn().mockResolvedValue({ data: ['c1', 'c2'] })

    useReadContractMock
      .mockImplementationOnce(() => ({
        data:         [7, true],
        refetch:      refetchToken,
        isLoading:    false,
        isRefetching: false,
      }))
      .mockImplementationOnce(() => ({
        data:      ['c1', 'c2'],
        refetch:   refetchColors,
        isLoading: false,
      }))

    const { result } = renderHookWithQuery(() => useNFTData())
    let p!: Promise<void>
    act(() => {
      p = result.current.forceRefresh()
      vi.advanceTimersByTime(500) // switching path waits 500ms
    })
    await act(async () => {
      await p
    })

    expect(refetchToken).toHaveBeenCalled()
    expect(refetchColors).toHaveBeenCalled()
    expect(completeAccountSwitch).toHaveBeenCalled()
    expect(setLoading).toHaveBeenLastCalledWith(false)

    // reset switching flag for isolation
    storeState.isSwitchingAccount = false
  })

  // Detect account switch on address change (not initial mount)
  it('detects address change → calls startAccountSwitch and clears store immediately', async () => {
    vi.useFakeTimers()
    // initial mount connected with A
    useAccountMock.mockReturnValue({ address: '0xAAA', isConnected: true })

    // simple wagmi read stubs
    useReadContractMock.mockReturnValue({
      data:         undefined,
      refetch:      vi.fn(),
      isLoading:    false,
      isRefetching: false,
    })

    const { rerender } = renderHookWithQuery(() => useNFTData())

    // change to B
    useAccountMock.mockReturnValue({ address: '0xBBB', isConnected: true })
    rerender(() => useNFTData())

    expect(startAccountSwitch).toHaveBeenCalled()

    // In the new implementation, clearing happens immediately (no 100ms delay)
    expect(setTokenData).toHaveBeenCalledWith(null, null, null)
    expect(setHasNFT).toHaveBeenCalledWith(false)
    expect(setHasUsedTokenGate).toHaveBeenCalledWith(false)
  })

  // Switch completes only when new data is ready (owned+colors) or not owned
  it('completes switch only after colors arrive when owned=true; completes immediately when owned=false', async () => {
    vi.useFakeTimers()
    storeState.isSwitchingAccount = true
    useAccountMock.mockReturnValue({ address: '0xCCC', isConnected: true })

    // Phase 1: owned=true but colors not ready -> should NOT complete yet
    let colorData: any = undefined
    useReadContractMock.mockImplementation((config: any) => {
      if (config.functionName === 'getTokenOfOwner') {
        return { data: [9, true], refetch: vi.fn(), isLoading: false, isRefetching: false }
      }
      if (config.functionName === 'getTokenColors') {
        return { data: colorData, refetch: vi.fn(), isLoading: false }
      }
      return { data: undefined, refetch: vi.fn(), isLoading: false, isRefetching: false }
    })

    const { rerender } = renderHookWithQuery(() => useNFTData())
    // advance a bit; no colors yet
    vi.advanceTimersByTime(200)
    expect(completeAccountSwitch).not.toHaveBeenCalled()

    // Phase 2: colors appear -> should complete after 300ms check + 200ms delay = 500ms total
    colorData = ['bgx', 'keyx']
    rerender(() => useNFTData())
    vi.advanceTimersByTime(500) // 300ms timeout + 200ms internal delay
    expect(completeAccountSwitch).toHaveBeenCalled()

    // Phase 3: owned=false -> completes after 300ms check
    completeAccountSwitch.mockClear()
    vi.clearAllTimers()
    storeState.isSwitchingAccount = true
    useReadContractMock.mockImplementation((config: any) => {
      if (config.functionName === 'getTokenOfOwner') {
        return { data: [0, false], refetch: vi.fn(), isLoading: false, isRefetching: false }
      }
      if (config.functionName === 'getTokenColors') {
        return { data: undefined, refetch: vi.fn(), isLoading: false }
      }
      return { data: undefined, refetch: vi.fn(), isLoading: false, isRefetching: false }
    })
    rerender(() => useNFTData())
    vi.advanceTimersByTime(300) // Just the check timeout, no additional delay for owned=false
    expect(completeAccountSwitch).toHaveBeenCalled()
  })

  // Polling cadence toggles with switching vs. normal
  it('sets refetchInterval faster during switch (1000ms) and slower otherwise (2000ms)', () => {
    // Capture calls to useReadContract to inspect query options
    const captured: any[] = []
    useReadContractMock.mockImplementation((opts: any) => {
      captured.push(opts)
      return { data: undefined, refetch: vi.fn(), isLoading: false, isRefetching: false }
    })

    // Normal (not switching)
    storeState.isSwitchingAccount = false
    useAccountMock.mockReturnValue({ address: '0xAAA', isConnected: true })
    renderHookWithQuery(() => useNFTData())
    const normalOwnerCall  = captured.find(c => c.functionName === 'getTokenOfOwner')
    const normalColorsCall = captured.find(c => c.functionName === 'getTokenColors')
    expect(normalOwnerCall.query.refetchInterval).toBe(2000)
    if (normalColorsCall?.query) {
      expect(normalColorsCall.query.refetchInterval).toBe(2000)
    }

    // Switching
    captured.length = 0
    storeState.isSwitchingAccount = true
    renderHookWithQuery(() => useNFTData())
    const switchOwnerCall  = captured.find(c => c.functionName === 'getTokenOfOwner')
    const switchColorsCall = captured.find(c => c.functionName === 'getTokenColors')
    expect(switchOwnerCall.query.refetchInterval).toBe(1000)
    if (switchColorsCall?.query) {
      expect(switchColorsCall.query.refetchInterval).toBe(1000)
    }
  })

  // ✅ FIXED: keep the SAME hook instance and rerender on disconnect so prevAddressRef is set
  it('disconnecting clears store (tokenData, hasNFT, hasUsedTokenGate)', () => {
    vi.useFakeTimers()
    // Mount connected
    useAccountMock.mockReturnValue({ address: '0xZZZ', isConnected: true })

    // minimal reads
    useReadContractMock.mockReturnValue({
      data:         undefined,
      refetch:      vi.fn(),
      isLoading:    false,
      isRefetching: false,
    })

    const { rerender } = renderHookWithQuery(() => useNFTData())

    // Now disconnect on the SAME instance
    useAccountMock.mockReturnValue({ address: null, isConnected: false })
    rerender(() => useNFTData())

    expect(setTokenData).toHaveBeenCalledWith(null, null, null)
    expect(setHasNFT).toHaveBeenCalledWith(false)
    expect(setHasUsedTokenGate).toHaveBeenCalledWith(false)
  })

  // NEW: when disconnected, contract queries are disabled
  it('disables contract queries when disconnected', () => {
    const captured: any[] = []
    useReadContractMock.mockImplementation((opts: any) => {
      captured.push(opts)
      return { data: undefined, refetch: vi.fn(), isLoading: false, isRefetching: false }
    })

    useAccountMock.mockReturnValue({ address: null, isConnected: false })
    renderHookWithQuery(() => useNFTData())

    const ownerCall = captured.find(c => c.functionName === 'getTokenOfOwner')
    const colorsCall = captured.find(c => c.functionName === 'getTokenColors')

    // when disconnected, enabled should be false for both (colors may be undefined if args disabled)
    expect(ownerCall.query.enabled).toBe(false)
    if (colorsCall?.query) {
      expect(colorsCall.query.enabled).toBe(false)
    }
  })
})