import React, { useState } from 'react'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import ConnectModal from '../ConnectModal'

/**
 * ---- MOCKS (hoisted) ----
 * Keep these first in the file so they apply before component import.
 */

// CSS modules: return default export; drop { virtual: true } (files exist on disk)
vi.mock('../styles/ModalWrapper.module.css', () => ({ default: {} }))
vi.mock('../styles/WalletList.module.css', () => ({ default: {} }))
vi.mock('../styles/Logo.module.css', () => ({ default: {} }))
vi.mock('../styles/ConnectingStates.module.css', () => ({ default: {} }))
vi.mock('../styles/GetWalletView.module.css', () => ({ default: {} }))
vi.mock('../styles/QrView.module.css', () => ({ default: {} }))

// Focus trap & swipe: no-ops so we don't test 3rd-party internals here
vi.mock('../hooks/useFocusTrap', () => ({ useFocusTrap: () => {} }))
vi.mock('../hooks/useSwipeToClose', () => ({ useSwipeToClose: () => ({}) }))

// QR lib: stub to avoid SVG noise
vi.mock('react-qr-code', () => ({
  __esModule: true,
  default: (props: any) => <div data-testid="qr" data-value={props.value} />,
}))

/**
 * next/navigation with a mutable pathname so we can simulate route changes
 */
let __mockPathname = '/'
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn() }),
  usePathname: () => __mockPathname,
}))

/**
 * Mock react-dom to avoid portal issues in tests
 */
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom')
  return {
    ...actual,
    createPortal: (node: any) => node,
  }
})

/**
 * wagmi mock with dynamic control over:
 *  - connectors (injected + walletConnect)
 *  - connectAsync behavior (resolve / reject / pending)
 *  - account connection state (isConnected)
 */
type ConnectorLike = {
  id: string
  name: string
  type: 'injected' | 'walletConnect' | string
  getProvider?: () => Promise<any>
  icon?: string
}

let __connectors: ConnectorLike[] = []
let __isConnected = false
let __chainId = 1

let __connectMode:
  | { type: 'resolve' }
  | { type: 'reject'; message: string }
  | { type: 'pending'; controls: { resolve: () => void; reject: (err?: any) => void } } = {
  type: 'resolve',
}

function __setConnectors(cs: ConnectorLike[]) { __connectors = cs }
function __setAccountConnected(v: boolean) { __isConnected = v }
function __setChainId(v: number) { __chainId = v }
function __setConnectResolve() { __connectMode = { type: 'resolve' } }
function __setConnectReject(message = 'Boom') { __connectMode = { type: 'reject', message } }
function __setConnectPending() {
  let resolve!: () => void
  let reject!: (err?: any) => void
  const controls = {
    resolve: () => resolve(),
    reject: (e?: any) => reject(e ?? new Error('pending rejected')),
  }
  __connectMode = { type: 'pending', controls }
  return controls
}

const mockReset = vi.fn()
const mockConnectAsync = vi.fn(async () => {
  if (__connectMode.type === 'resolve') return {}
  if (__connectMode.type === 'reject') throw new Error(__connectMode.message)
  // pending: hook the external controls to this promise instance
  return new Promise<void>((res, rej) => {
    ;(__connectMode as any).controls.resolve = () => res()
    ;(__connectMode as any).controls.reject = (e?: any) => rej(e ?? new Error('pending rejected'))
  })
})
const mockSwitchChainAsync = vi.fn(async () => {})

vi.mock('wagmi', () => ({
  useAccount: () => ({ isConnected: __isConnected }),
  useChainId: () => __chainId,
  useConnect: () => ({
    connectors: __connectors,
    connectAsync: mockConnectAsync,
    reset: mockReset,
  }),
  useSwitchChain: () => ({ switchChainAsync: mockSwitchChainAsync }),
}))

// helpers to control WalletConnect provider events (typed; no `Function`)
type WCProviderEvents = {
  display_uri: (uri: string) => void
}

function createFakeWCProvider() {
  type EventKey = keyof WCProviderEvents
  const listeners: Partial<{ [K in EventKey]: WCProviderEvents[K][] }> = {}

  return {
    on<K extends EventKey>(event: K, cb: WCProviderEvents[K]) {
      const arr = (listeners[event] ??= [] as WCProviderEvents[K][])
      arr.push(cb)
    },
    emit<K extends EventKey>(event: K, ...args: unknown[]) {
      const arr = listeners[event] as WCProviderEvents[K][] | undefined
      arr?.forEach((cb) => {
        // We know each event has a consistent signature
        ;(cb as (...cbArgs: unknown[]) => void)(...args)
      })
    },
  }
}


/**
 * Harness to control isOpen + spy onClose, and to simulate re-open cycles.
 */
function Harness(props: { initiallyOpen?: boolean; onCloseSpy?: () => void }) {
  const { initiallyOpen = true, onCloseSpy } = props
  const [open, setOpen] = useState(initiallyOpen)
  return (
    <ConnectModal
      isOpen={open}
      onClose={() => {
        onCloseSpy?.()
        setOpen(false)
      }}
    />
  )
}

/**
 * ---- TESTS ----
 */
describe('ConnectModal integration', () => {
  let wcProvider: ReturnType<typeof createFakeWCProvider>

  beforeEach(() => {
    ;(window as any).__RITOSWAP_MOBILE_OVERRIDE__ = false

    // Ensure document.body exists
    if (!document.body) {
      document.body = document.createElement('body')
    }

    // reset wagmi
    wcProvider = createFakeWCProvider()
    __setAccountConnected(false)
    __setChainId(1)
    __setConnectResolve()
    mockReset.mockClear()
    mockConnectAsync.mockClear()
    mockSwitchChainAsync.mockClear()

    // Reset pathname
    __mockPathname = '/'

    // two connectors by default: injected + walletConnect
    __setConnectors([
      {
        id: 'inj-1',
        name: 'MetaMask',
        type: 'injected',
        icon: '/images/metamask.png',
      },
      {
        id: 'wc-1',
        name: 'WalletConnect',
        type: 'walletConnect',
        icon: '/images/wallets/walletconnect.png',
        getProvider: async () => wcProvider,
      },
    ])

    // clipboard mock (getter-only prop => define it)
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    delete (window as any).__RITOSWAP_MOBILE_OVERRIDE__
  })

  it('renders default view with available connectors and closes on backdrop', async () => {
    const onClose = vi.fn()
    render(<ConnectModal isOpen={true} onClose={onClose} />)

    // Wait for modal to render
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /connect your wallet/i })
      ).toBeInTheDocument()
    })

    // Wallet buttons are role="listitem" because WalletButton explicitly sets role="listitem"
    expect(screen.getByLabelText(/connect with metamask/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/connect with walletconnect/i)).toBeInTheDocument()

    // Backdrop closes
    fireEvent.click(screen.getByLabelText(/close modal/i))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('injected flow: shows Connecting, then auto-closes when account becomes connected (while connecting)', async () => {
    const onClose = vi.fn()
    const { rerender } = render(<ConnectModal isOpen={true} onClose={onClose} />)

    // Wait for modal to render
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /connect your wallet/i })
      ).toBeInTheDocument()
    })

    // Keep connectAsync pending so we stay in "connecting"
    const pending = __setConnectPending()

    // Use getByLabelText since buttons have role="listitem"
    fireEvent.click(screen.getByLabelText(/connect with metamask/i))

    // Wait for "Connecting…" to appear
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByText(/connecting/i)).toBeInTheDocument()
    })

    // Flip account to connected while still connecting, then force rerender
    await act(async () => {
      __setAccountConnected(true)
      rerender(<ConnectModal isOpen={true} onClose={onClose} />)
    })

    // Modal should call onClose and unmount
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    // resolve the pending promise to flush any awaiting
    await act(async () => {
      pending.resolve()
    })
  })

  it('walletconnect desktop: shows QR view, handles display_uri + copy', async () => {
    render(<Harness />)

    // Wait for modal to render
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /connect your wallet/i })
      ).toBeInTheDocument()
    })

    // Keep connectAsync pending so QR view persists
    __setConnectPending()

    // Click WalletConnect - use getByLabelText
    fireEvent.click(screen.getByLabelText(/connect with walletconnect/i))

    // Desktop: should show QR view region
    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: /scan with phone's wallet/i })
      ).toBeInTheDocument()
    })

    // Emit display_uri from provider => QR becomes "ready"
    await act(async () => {
      wcProvider.emit('display_uri', 'wc://example')
    })

    // QR node exists with correct value
    const qr = await screen.findByTestId('qr')
    expect(qr).toHaveAttribute('data-value', 'wc://example')

    // Copy button enabled and toggles label after click
    const copyBtn = screen.getByRole('button', { name: /copy connection link to clipboard/i })
    expect(copyBtn).toBeEnabled()

    await act(async () => {
      fireEvent.click(copyBtn)
    })

    // After clicking, aria-label changes to indicate "Copied!"
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /copied to clipboard/i })
      ).toBeInTheDocument()
    })
  })

  it('walletconnect mobile: goes to Connecting view and shows Open Wallet button', async () => {
    ;(window as any).__RITOSWAP_MOBILE_OVERRIDE__ = true

    // capture original location and override
    const originalLocation = window.location
    let lastHref: string | undefined

    delete (window as any).location
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        ...originalLocation,
        set href(val: string) { lastHref = val },
        get href() { return lastHref ?? originalLocation.href },
      },
    })

    render(<Harness />)

    // Wait for modal to render
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /connect your wallet/i })
      ).toBeInTheDocument()
    })

    // Keep connectAsync pending so it stays in Connecting
    __setConnectPending()

    // Use getByLabelText since buttons have role="listitem"
    fireEvent.click(screen.getByLabelText(/connect with walletconnect/i))

    // On mobile, it should jump to Connecting view (not QR)
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByText(/connecting/i)).toBeInTheDocument()
    })

    // Emit display_uri so "Open Wallet" becomes available
    await act(async () => {
      wcProvider.emit('display_uri', 'wc://mobile')
    })

    // Open Wallet button appears
    const openBtn = await screen.findByRole('button', { name: /open wallet app/i })
    expect(openBtn).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(openBtn)
    })
    expect(lastHref).toBe('wc://mobile')

    // restore location
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    })
  })

  it('error and canceled paths render and reset back to default', async () => {
    render(<Harness />)

    // Wait for modal to render
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /connect your wallet/i })
      ).toBeInTheDocument()
    })

    // Canceled (user rejected)
    __setConnectReject('User rejected the request')

    // Use getByLabelText since buttons have role="listitem"
    fireEvent.click(screen.getByLabelText(/connect with metamask/i))

    // Shows canceled
    await waitFor(() => {
      expect(screen.getByText(/connection canceled by user/i)).toBeInTheDocument()
    })

    // After 1500ms reset to default - wait naturally without fake timers
    await waitFor(
      () => {
        expect(
          screen.getByRole('heading', { name: /connect your wallet/i })
        ).toBeInTheDocument()
      },
      { timeout: 2000 }
    )

    // Generic error
    __setConnectReject('Something exploded')
    fireEvent.click(screen.getByLabelText(/connect with metamask/i))

    await waitFor(() => {
      expect(screen.getByText(/connection unsuccessful/i)).toBeInTheDocument()
    })

    await waitFor(
      () => {
        expect(
          screen.getByRole('heading', { name: /connect your wallet/i })
        ).toBeInTheDocument()
      },
      { timeout: 2000 }
    )
  })

  it('route change auto-closes when modal is open', async () => {
    const onClose = vi.fn()
    __mockPathname = '/a'
    const { rerender } = render(<ConnectModal isOpen={true} onClose={onClose} />)

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /connect your wallet/i })
      ).toBeInTheDocument()
    })

    // Simulate route change by flipping pathname and forcing a rerender
    __mockPathname = '/b'
    rerender(<ConnectModal isOpen={true} onClose={onClose} />)

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('closing while not connecting resets state for next open (no stale QR/copies)', async () => {
    // open -> go to WC QR -> close -> open again => back to Default
    function ReopenerHarness() {
      const [open, setOpen] = useState(true)
      return (
        <>
          <button onClick={() => setOpen(true)}>Reopen</button>
          <ConnectModal isOpen={open} onClose={() => setOpen(false)} />
        </>
      )
    }

    render(<ReopenerHarness />)

    // Wait for modal to render initially
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /connect your wallet/i })
      ).toBeInTheDocument()
    })

    // Keep connectAsync pending before going to QR
    __setConnectPending()

    // Go to QR - use getByLabelText since buttons have role="listitem"
    fireEvent.click(screen.getByLabelText(/connect with walletconnect/i))
    
    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: /scan with phone's wallet/i })
      ).toBeInTheDocument()
    })

    await act(async () => {
      wcProvider.emit('display_uri', 'wc://again')
    })
    
    expect(await screen.findByTestId('qr')).toBeInTheDocument()

    // Close via backdrop
    fireEvent.click(screen.getByLabelText(/close modal/i))
    
    // Modal gone
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // Reopen
    fireEvent.click(screen.getByRole('button', { name: /reopen/i }))
    
    // Should be default view again
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /connect your wallet/i })
      ).toBeInTheDocument()
    })
  })
})
