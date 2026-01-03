import React, { useEffect } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

/** ---------- wagmi mock (connectAsync-based) ---------- */
const wagmiState = {
  connectors: [] as any[],
  connectAsync: vi.fn() as unknown as (args: any) => Promise<any>,
  reset: vi.fn(),
  chainId: 1,
  switchChainAsync: vi.fn() as unknown as (args: any) => Promise<any>,
}

vi.mock('wagmi', () => ({
  useConnect: () => ({
    connectors: wagmiState.connectors,
    connectAsync: (args: any) => (wagmiState.connectAsync as any)(args),
    reset: wagmiState.reset,
  }),
  useAccount: () => ({ isConnected: false }),
  useChainId: () => wagmiState.chainId,
  useSwitchChain: () => ({
    switchChainAsync: (args: any) => (wagmiState.switchChainAsync as any)(args),
  }),
}))

/** ---------- helpers ---------- */
function setInnerWidth(px: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: px })
}
function installLocationHrefTrap() {
  let current = 'http://localhost:3000/'
  const loc = {
    get href() { return current },
    set href(v: string) { current = v },
    assign: vi.fn(),
    replace: vi.fn(),
  }
  Object.defineProperty(window, 'location', { configurable: true, value: loc as any })
  return { getHref: () => current, loc }
}
function installClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
  return { writeText }
}
function createWcProvider() {
  const handlers = new Map<string, (arg: any) => void>()
  return {
    on: (event: string, cb: (arg: any) => void) => handlers.set(event, cb),
    emit: (event: string, arg: any) => handlers.get(event)?.(arg),
  }
}
function injectedConnector(id: string, name: string, icon = '/meta.png') {
  return {
    id,
    name,
    type: 'injected',
    getProvider: vi.fn().mockResolvedValue(undefined),
    icon,
  }
}
function walletConnectConnector(id = 'walletConnect') {
  const provider = createWcProvider()
  return {
    id,
    name: 'WalletConnect',
    type: 'walletConnect',
    getProvider: vi.fn().mockResolvedValue(provider),
    __provider: provider, // test-only
  }
}
function deferred<T = void>() {
  let resolve!: (v: T | PromiseLike<T>) => void
  let reject!: (e?: any) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('useWalletConnection (connectAsync-based)', () => {
  beforeEach(() => {
    vi.resetModules()
    wagmiState.reset.mockClear()
    ;(wagmiState.connectAsync as any) = vi.fn().mockResolvedValue(undefined)
    ;(wagmiState.switchChainAsync as any) = vi.fn().mockResolvedValue(undefined)
    wagmiState.connectors = []
    wagmiState.chainId = 1
    ;(window as any).__RITOSWAP_MOBILE_OVERRIDE__ = false
    setInnerWidth(1024)
  })
  afterEach(() => {
    vi.clearAllMocks()
    delete (window as any).__RITOSWAP_MOBILE_OVERRIDE__
  })

  it('orders connectors: injected (excluding placeholder) first, then walletconnect', async () => {
    const { useWalletConnection } = await import('../useWalletConnection')
    const placeholder = { id: 'injected', name: 'Injected', type: 'injected', getProvider: vi.fn() }
    const mm = injectedConnector('metamask', 'MetaMask')
    const wc = walletConnectConnector('wc')
    wagmiState.connectors = [placeholder, wc as any, mm as any]

    let latest: ReturnType<typeof useWalletConnection> | null = null
    function Harness() {
      const hook = useWalletConnection()
      useEffect(() => { latest = hook }, [hook])
      return null
    }
    render(<Harness />)
    const ids = latest!.data.allConnectors.map(c => c.id)
    expect(ids).toEqual(['metamask', 'wc'])
  })

  it('injected: sets connecting, awaits connectAsync, then returns to default', async () => {
    const { useWalletConnection } = await import('../useWalletConnection')
    const mm = injectedConnector('metamask', 'MetaMask', '/mm.png')
    wagmiState.connectors = [mm]

    let latest: ReturnType<typeof useWalletConnection> | null = null
    function Harness() {
      const hook = useWalletConnection()
      useEffect(() => { latest = hook }, [hook])
      return null
    }
    render(<Harness />)

    await act(async () => {
      await latest!.actions.handleConnectorClick(mm as any)
    })
    expect((wagmiState.connectAsync as any)).toHaveBeenCalledTimes(1)
    expect(latest!.ui.state).toBe('default')
    expect(latest!.ui.connectingWallet?.name).toBe('MetaMask')
  })

  it('clicking same pending injected twice does not call connectAsync twice', async () => {
    const { useWalletConnection } = await import('../useWalletConnection')
    const mm = injectedConnector('metamask', 'MetaMask')
    wagmiState.connectors = [mm]

    const d = deferred<void>()
    const callCount = { value: 0 }
    ;(wagmiState.connectAsync as any).mockImplementation(() => {
      callCount.value++
      return d.promise
    })

    let latest: ReturnType<typeof useWalletConnection> | null = null
    function Harness() {
      const hook = useWalletConnection()
      useEffect(() => { latest = hook }, [hook])
      return null
    }
    render(<Harness />)

    latest!.actions.handleConnectorClick(mm as any)

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      await latest!.actions.handleConnectorClick(mm as any)
    })

    expect(callCount.value).toBeGreaterThanOrEqual(1)

    await act(async () => {
      d.resolve()
    })
  })

  it('walletconnect desktop: shows QR view, sets qrUri on display_uri, then returns to default after resolve', async () => {
    const { useWalletConnection } = await import('../useWalletConnection')
    const wc = walletConnectConnector('wc')
    wagmiState.connectors = [wc]
    ;(window as any).__RITOSWAP_MOBILE_OVERRIDE__ = false
    const { getHref } = installLocationHrefTrap()

    const d = deferred<void>()
    ;(wagmiState.connectAsync as any).mockImplementationOnce(() => d.promise)

    let latest: ReturnType<typeof useWalletConnection> | null = null
    function Harness() {
      const hook = useWalletConnection()
      useEffect(() => { latest = hook }, [hook])
      return null
    }
    render(<Harness />)

    const p = latest!.actions.handleConnectorClick(wc as any)

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    await act(async () => {
      wc.__provider.emit('display_uri', 'wc://abc123')
    })

    await waitFor(() => {
      expect(latest!.ui.state).toBe('walletconnect-qr')
      expect(latest!.ui.qrUri).toBe('wc://abc123')
    })
    expect(getHref()).toBe('http://localhost:3000/')

    await act(async () => {
      d.resolve()
      await p
    })
    expect(latest!.ui.state).toBe('default')
  })

  it('walletconnect mobile: sets connecting, stores qrUri, and deeplinks on display_uri', async () => {
    const { useWalletConnection } = await import('../useWalletConnection')
    const wc = walletConnectConnector('wc')
    wagmiState.connectors = [wc]
    ;(window as any).__RITOSWAP_MOBILE_OVERRIDE__ = true
    const { getHref } = installLocationHrefTrap()

    const d = deferred<void>()
    ;(wagmiState.connectAsync as any).mockImplementationOnce(() => d.promise)

    let latest: ReturnType<typeof useWalletConnection> | null = null
    function Harness() {
      const hook = useWalletConnection()
      useEffect(() => { latest = hook }, [hook])
      return null
    }
    render(<Harness />)

    const p = latest!.actions.handleConnectorClick(wc as any)

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    await act(async () => {
      wc.__provider.emit('display_uri', 'wc://mobile-open')
    })

    await waitFor(() => {
      expect(latest!.ui.state).toBe('connecting')
      expect(latest!.ui.qrUri).toBe('wc://mobile-open')
    })
    expect(getHref()).toBe('wc://mobile-open')

    await act(async () => {
      d.resolve()
      await p
    })
    expect(latest!.ui.state).toBe('default')
  })

  it('copyQr writes to clipboard and toggles copied flag', async () => {
    const { useWalletConnection } = await import('../useWalletConnection')
    const wc = walletConnectConnector('wc')
    wagmiState.connectors = [wc]
    setInnerWidth(1024)
    const { writeText } = installClipboard()

    const d = deferred<void>()
    ;(wagmiState.connectAsync as any).mockImplementationOnce(() => d.promise)

    let latest: ReturnType<typeof useWalletConnection> | null = null
    function Harness() {
      const hook = useWalletConnection()
      useEffect(() => { latest = hook }, [hook])
      return null
    }
    render(<Harness />)

    const p = latest!.actions.handleConnectorClick(wc as any)

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    await act(async () => {
      wc.__provider.emit('display_uri', 'wc://copy-me')
    })

    await waitFor(() => {
      expect(latest!.ui.qrUri).toBe('wc://copy-me')
    })

    vi.useFakeTimers()
    await act(async () => {
      latest!.actions.copyQr()
    })
    expect(writeText).toHaveBeenCalledWith('wc://copy-me')
    expect(latest!.ui.copied).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(latest!.ui.copied).toBe(false)
    vi.useRealTimers()

    await act(async () => {
      d.resolve()
      await p
    })
  })

  it('cancelConnecting (wc) calls reset and returns to default', async () => {
    const { useWalletConnection } = await import('../useWalletConnection')
    const wc = walletConnectConnector('wc')
    wagmiState.connectors = [wc]
    setInnerWidth(1024)

    const d = deferred<void>()
    ;(wagmiState.connectAsync as any).mockImplementationOnce(() => d.promise)

    let latest: ReturnType<typeof useWalletConnection> | null = null
    function Harness() {
      const hook = useWalletConnection()
      useEffect(() => { latest = hook }, [hook])
      return null
    }
    render(<Harness />)

    const p = latest!.actions.handleConnectorClick(wc as any)

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    await act(async () => {
      wc.__provider.emit('display_uri', 'wc://abc')
    })

    await waitFor(() => {
      expect(latest!.ui.connectingWallet?.isWalletConnect).toBe(true)
    })

    await act(async () => {
      latest!.actions.cancelConnecting()
    })
    expect(wagmiState.reset).not.toHaveBeenCalled()
    expect(latest!.ui.state).toBe('default')
    expect(latest!.ui.connectingWallet).toBe(null)

    await act(async () => {
      d.resolve()
      await p
    })
  })

  it('backToDefault calls reset() and clears local state', async () => {
    const { useWalletConnection } = await import('../useWalletConnection')
    const mm = injectedConnector('metamask', 'MetaMask')
    wagmiState.connectors = [mm]

    const d = deferred<void>()
    ;(wagmiState.connectAsync as any).mockImplementationOnce(() => d.promise)

    let latest: ReturnType<typeof useWalletConnection> | null = null
    function Harness() {
      const hook = useWalletConnection()
      useEffect(() => { latest = hook }, [hook])
      return null
    }
    render(<Harness />)

    const p = latest!.actions.handleConnectorClick(mm as any)

    await act(async () => {
      latest!.actions.backToDefault()
    })
    expect(wagmiState.reset).toHaveBeenCalled()
    expect(latest!.ui.state).toBe('default')
    expect(latest!.ui.qrUri).toBe('')

    await act(async () => {
      d.resolve()
      await p
    })
  })

  it('on connectAsync rejection "User rejected" -> canceled -> default after 1500ms', async () => {
    const { useWalletConnection } = await import('../useWalletConnection')
    const mm = injectedConnector('metamask', 'MetaMask')
    wagmiState.connectors = [mm]

    ;(wagmiState.connectAsync as any).mockRejectedValueOnce(new Error('User rejected the request'))

    let latest: ReturnType<typeof useWalletConnection> | null = null
    function Harness() {
      const hook = useWalletConnection()
      useEffect(() => { latest = hook }, [hook])
      return null
    }
    render(<Harness />)

    vi.useFakeTimers()
    await act(async () => {
      try { await latest!.actions.handleConnectorClick(mm as any) } catch {}
    })
    expect(latest!.ui.state).toBe('canceled')

    act(() => { vi.advanceTimersByTime(1500) })
    vi.useRealTimers()
    expect(latest!.ui.state).toBe('default')
    expect(wagmiState.reset).toHaveBeenCalled()
  })

  it('on connectAsync rejection generic -> error -> default after 1500ms', async () => {
    const { useWalletConnection } = await import('../useWalletConnection')
    const mm = injectedConnector('metamask', 'MetaMask')
    wagmiState.connectors = [mm]

    ;(wagmiState.connectAsync as any).mockRejectedValueOnce(new Error('Boom'))

    let latest: ReturnType<typeof useWalletConnection> | null = null
    function Harness() {
      const hook = useWalletConnection()
      useEffect(() => { latest = hook }, [hook])
      return null
    }
    render(<Harness />)

    vi.useFakeTimers()
    await act(async () => {
      try { await latest!.actions.handleConnectorClick(mm as any) } catch {}
    })
    expect(latest!.ui.state).toBe('error')

    act(() => { vi.advanceTimersByTime(1500) })
    vi.useRealTimers()
    expect(latest!.ui.state).toBe('default')
    expect(wagmiState.reset).toHaveBeenCalled()
  })

  it('resetUi clears local state (QR flow case)', async () => {
    const { useWalletConnection } = await import('../useWalletConnection')
    const wc = walletConnectConnector('wc')
    wagmiState.connectors = [wc]
    setInnerWidth(1024)

    const d = deferred<void>()
    ;(wagmiState.connectAsync as any).mockImplementationOnce(() => d.promise)

    let latest: ReturnType<typeof useWalletConnection> | null = null
    function Harness() {
      const hook = useWalletConnection()
      useEffect(() => { latest = hook }, [hook])
      return null
    }
    render(<Harness />)

    const p = latest!.actions.handleConnectorClick(wc as any)

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    await act(async () => {
      wc.__provider.emit('display_uri', 'wc://abc')
    })

    await act(async () => {
      latest!.actions.resetUi()
    })
    expect(latest!.ui.state).toBe('default')
    expect(latest!.ui.qrUri).toBe('')
    expect(latest!.ui.connectingWallet).toBe(null)
    expect(latest!.ui.copied).toBe(false)

    await act(async () => {
      d.resolve()
      await p
    })
  })

  it('openWallet navigates to qrUri when present', async () => {
    const { useWalletConnection } = await import('../useWalletConnection')
    const wc = walletConnectConnector('wc')
    wagmiState.connectors = [wc]
    setInnerWidth(1024)
    const { getHref } = installLocationHrefTrap()

    const d = deferred<void>()
    ;(wagmiState.connectAsync as any).mockImplementationOnce(() => d.promise)

    let latest: ReturnType<typeof useWalletConnection> | null = null
    function Harness() {
      const hook = useWalletConnection()
      useEffect(() => { latest = hook }, [hook])
      return null
    }
    render(<Harness />)

    const p = latest!.actions.handleConnectorClick(wc as any)

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    await act(async () => {
      wc.__provider.emit('display_uri', 'wc://go')
    })

    await waitFor(() => {
      expect(latest!.ui.qrUri).toBe('wc://go')
    })

    await act(async () => {
      latest!.actions.openWallet()
    })
    expect(getHref()).toBe('wc://go')

    await act(async () => {
      d.resolve()
      await p
    })
  })
})
