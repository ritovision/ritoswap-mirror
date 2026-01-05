// dapp/app/hooks/__tests__/useMintBurn.test.tsx
import { renderHook, act } from '@testing-library/react'
import { useMintBurn } from '../useMintBurn'

// ─── Hoisted/shared spies used across mocks (avoid init order issues) ────────
const h = vi.hoisted(() => ({
  eventSpy: vi.fn(),                 // sendNotificationEvent
  errorSpy: vi.fn(),                 // sendErrorNotification
  formatMintErrorSpy: vi.fn((e: Error) => `Mint failed: ${e.message}`),
  formatBurnErrorSpy: vi.fn((e: Error) => `Burn failed: ${e.message}`),
  openWalletSpy: vi.fn(),            // openWalletDeeplink
}))

// ----------------------------- Shared state ---------------------------------
let execSpy = vi.fn<(fn: () => void) => void>()
let isMobileVar = true
let connectorIdVar: string | null = 'walletConnect'

let mintWriteSpy = vi.fn()
let burnWriteSpy = vi.fn()
let mintResetSpy = vi.fn()
let burnResetSpy = vi.fn()

let mintedHashVar: `0x${string}` | undefined
let burnedHashVar: `0x${string}` | undefined
let mintErrorVar: Error | undefined
let burnErrorVar: Error | undefined
let mintPendingVar = false
let burnPendingVar = false
let mintSuccessVar = false
let burnSuccessVar = false

let writeHookCallIndex = 0

// ----------------------------- Mocks ----------------------------------------
vi.mock('wagmi', () => ({
  useAccount: () => ({
    connector: connectorIdVar ? { id: connectorIdVar } : null,
  }),

  useWriteContract: () => {
    writeHookCallIndex = (writeHookCallIndex % 2) + 1
    const isMint = writeHookCallIndex === 1

    if (isMint) {
      return {
        writeContract: (action: any) => {
          mintPendingVar = true
          mintWriteSpy(action)
          mintedHashVar = '0xM1' as any
        },
        get data() { return mintedHashVar },
        get isPending() { return mintPendingVar },
        get error() { return mintErrorVar },
        reset: () => {
          mintResetSpy()
          mintedHashVar = undefined
          mintErrorVar = undefined
          mintPendingVar = false
        },
      }
    }
    return {
      writeContract: (action: any) => {
        burnPendingVar = true
        burnWriteSpy(action)
        burnedHashVar = '0xB1' as any
      },
      get data() { return burnedHashVar },
      get isPending() { return burnPendingVar },
      get error() { return burnErrorVar },
      reset: () => {
        burnResetSpy()
        burnedHashVar = undefined
        burnErrorVar = undefined
        burnPendingVar = false
      },
    }
  },

  useWaitForTransactionReceipt: (opts: { hash?: `0x${string}` }) => {
    const hash = opts?.hash
    if (hash && hash === mintedHashVar) {
      return { isLoading: !mintSuccessVar, isSuccess: mintSuccessVar }
    }
    if (hash && hash === burnedHashVar) {
      return { isLoading: !burnSuccessVar, isSuccess: burnSuccessVar }
    }
    return { isLoading: false, isSuccess: false }
  },
}))

vi.mock('@/components/providers/DappChainProvider', () => ({
  useDappChain: () => ({
    dappChainId: 1,
    setDappChainId: vi.fn(),
    resetToActiveChain: vi.fn(),
    isOnActiveChain: true,
  }),
}))

vi.mock('@/app/utils/mobile', () => ({
  isMobileDevice: () => isMobileVar,
}))

vi.mock('@/app/utils/walletDeeplink', () => ({
  openWalletDeeplink: h.openWalletSpy,
  DUMMY_WALLETCONNECT_URI: 'wc:ritoswap',
}))

vi.mock('@hooks/useNetworkCheck', () => ({
  useNetworkCheck: () => ({
    executeWithNetworkCheck: (fn: () => void) => execSpy(fn),
  }),
}))

// ✅ Mock the notifications facade your hook actually uses
vi.mock('@/app/lib/notifications', () => ({
  sendNotificationEvent: h.eventSpy,
  sendErrorNotification: h.errorSpy,
}))

// ✅ Mock client helpers; error formatters trigger notifications too
vi.mock('@lib/client/mint.client', () => ({
  createMintAction: () => ({ kind: 'MINT_ACTION' }),
  createBurnAction: (id: number | string) => ({ kind: 'BURN_ACTION', id }),
  formatMintError: (e: Error) => {
    const msg = h.formatMintErrorSpy(e)
    h.errorSpy(msg)
    return msg
  },
  formatBurnError: (e: Error) => {
    const msg = h.formatBurnErrorSpy(e)
    h.errorSpy(msg)
    return msg
  },
}))

// ----------------------------- Helpers --------------------------------------
const setup = (opts?: Parameters<typeof useMintBurn>[0]) =>
  renderHook(() => useMintBurn({ notificationDelay: 20, ...(opts || {}) }))

// ----------------------------- Tests ----------------------------------------
describe('useMintBurn', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

  beforeEach(() => {
    vi.useFakeTimers()

    execSpy.mockClear()
    h.openWalletSpy.mockClear()
    mintWriteSpy.mockClear()
    burnWriteSpy.mockClear()
    mintResetSpy.mockClear()
    burnResetSpy.mockClear()
    h.eventSpy.mockClear()
    h.errorSpy.mockClear()
    h.formatMintErrorSpy.mockClear()
    h.formatBurnErrorSpy.mockClear()
    logSpy.mockClear()

    mintedHashVar = undefined
    burnedHashVar = undefined
    mintErrorVar = undefined
    burnErrorVar = undefined
    mintPendingVar = false
    burnPendingVar = false
    mintSuccessVar = false
    burnSuccessVar = false
    writeHookCallIndex = 0
    isMobileVar = true
    connectorIdVar = 'walletConnect'

    execSpy.mockImplementation((fn) => fn())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mint() writes contract and opens wallet deeplink on mobile WalletConnect', () => {
    const { result } = setup()
    act(() => { result.current.mint() })
    expect(execSpy).not.toHaveBeenCalled()
    expect(mintWriteSpy).toHaveBeenCalledWith({ kind: 'MINT_ACTION' })
    expect(h.openWalletSpy).toHaveBeenCalledTimes(1)
  })

  it('burn() with missing tokenId notifies error and does not write', () => {
    const { result } = setup()
    act(() => { result.current.burn(null) })
    expect(h.errorSpy).toHaveBeenCalledWith('No token ID available for burning')
    expect(execSpy).not.toHaveBeenCalled()
    expect(burnWriteSpy).not.toHaveBeenCalled()
  })

  it('handles successful mint: logs, schedules notification, dedupes same hash', async () => {
    const onMintSuccess = vi.fn()
    const { result, rerender } = setup({ onMintSuccess, notificationDelay: 10 })

    // start mint -> sets hash
    act(() => { result.current.mint() })
    // let the hook see mintHash
    act(() => { rerender() })

    // mark receipt success and re-run effects
    mintSuccessVar = true
    act(() => { rerender() })

    // immediate log
    expect(logSpy).toHaveBeenCalledWith('Mint transaction:', '0xM1')

    // run all pending timers (notification + callback/reset)
    await act(async () => {
      vi.runOnlyPendingTimers()
    })

    expect(h.eventSpy).toHaveBeenCalledWith('NFT_MINTED', { source: 'user' })
    expect(onMintSuccess).toHaveBeenCalledTimes(1)
    expect(mintResetSpy).toHaveBeenCalledTimes(1)

    // dedupe: subsequent rerender with same hash should not fire again
    act(() => { rerender() })
    expect(logSpy).toHaveBeenCalledTimes(1)
    expect(h.eventSpy).toHaveBeenCalledTimes(1)
  })

  it('handles mint error: formats, notifies, calls onMintError, resets', () => {
    const onMintError = vi.fn()
    const { rerender } = setup({ onMintError })

    mintErrorVar = new Error('boom mint')
    act(() => { rerender() })

    expect(h.formatMintErrorSpy).toHaveBeenCalled()
    expect(h.errorSpy).toHaveBeenCalledWith('Mint failed: boom mint')
    expect(onMintError).toHaveBeenCalledTimes(1)
    expect(mintResetSpy).toHaveBeenCalledTimes(1)
  })

  it('handles successful burn: logs + notification', async () => {
    const onBurnSuccess = vi.fn()
    const { result, rerender } = setup({ onBurnSuccess, notificationDelay: 10 })

    act(() => { result.current.burn(7) })
    act(() => { rerender() })

    burnSuccessVar = true
    act(() => { rerender() })

    expect(logSpy).toHaveBeenCalledWith('Burn transaction:', '0xB1')

    await act(async () => {
      vi.runOnlyPendingTimers()
    })

    expect(h.eventSpy).toHaveBeenCalledWith('NFT_BURNED', { source: 'user' })
    expect(onBurnSuccess).toHaveBeenCalledTimes(1)
    expect(burnResetSpy).toHaveBeenCalledTimes(1)
  })

  it('handles burn error: formats, notifies, calls onBurnError, resets', () => {
    const onBurnError = vi.fn()
    const { rerender } = setup({ onBurnError })

    burnErrorVar = new Error('boom burn')
    act(() => { rerender() })

    expect(h.formatBurnErrorSpy).toHaveBeenCalled()
    expect(h.errorSpy).toHaveBeenCalledWith('Burn failed: boom burn')
    expect(onBurnError).toHaveBeenCalledTimes(1)
    expect(burnResetSpy).toHaveBeenCalledTimes(1)
  })

  it('does not open wallet when not WalletConnect', () => {
    connectorIdVar = 'injected'
    const { result } = setup()
    act(() => { result.current.mint() })
    act(() => { result.current.burn(1) })
    expect(h.openWalletSpy).not.toHaveBeenCalled()
  })

  it('does not open wallet when not on mobile', () => {
    isMobileVar = false
    const { result } = setup()
    act(() => { result.current.mint() })
    act(() => { result.current.burn(1) })
    expect(h.openWalletSpy).not.toHaveBeenCalled()
  })
})
