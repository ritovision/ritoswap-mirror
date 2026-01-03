// dapp/app/hooks/__tests__/useWalletConnectGuards.test.tsx
import { renderHook } from '@testing-library/react'
import { useWalletConnectGuards } from '../useWalletConnectGuards'

const ANDROID_CHROME_UA =
  'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Mobile Safari/537.36'

const setUserAgent = (userAgent: string) => {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: userAgent,
    configurable: true,
  })
}

describe('useWalletConnectGuards', () => {
  let originalOpen: typeof window.open
  let originalUserAgent: string

  beforeEach(() => {
    originalOpen = window.open
    originalUserAgent = window.navigator.userAgent
  })

  afterEach(() => {
    window.open = originalOpen
    Object.defineProperty(window.navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  it('does not install guards when disabled', () => {
    const openMock = vi.fn(() => ({} as Window))
    window.open = openMock

    renderHook(() => useWalletConnectGuards(false))

    window.open('https://rainbow.me/')
    expect(openMock).toHaveBeenCalledTimes(1)
  })

  it('blocks blacklisted popups and allows safe URLs', () => {
    const windowRef = {} as Window
    const openMock = vi.fn(() => windowRef)
    window.open = openMock
    vi.spyOn(console, 'log').mockImplementation(() => {})

    renderHook(() => useWalletConnectGuards(true))

    const blocked = window.open('https://rainbow.me/')
    expect(blocked).toBeNull()
    expect(openMock).not.toHaveBeenCalled()

    const allowed = window.open('wc://session')
    expect(allowed).toBe(windowRef)
    expect(openMock).toHaveBeenCalledTimes(1)
  })

  it('blocks http(s) popups on Android Chrome', () => {
    setUserAgent(ANDROID_CHROME_UA)
    const windowRef = {} as Window
    const openMock = vi.fn(() => windowRef)
    window.open = openMock
    vi.spyOn(console, 'log').mockImplementation(() => {})

    renderHook(() => useWalletConnectGuards())

    const blocked = window.open('https://example.com')
    expect(blocked).toBeNull()
    expect(openMock).not.toHaveBeenCalled()

    const allowed = window.open('wc://session')
    expect(allowed).toBe(windowRef)
    expect(openMock).toHaveBeenCalledTimes(1)
  })

  it('prevents beforeunload to blacklisted domains on Android Chrome', () => {
    setUserAgent(ANDROID_CHROME_UA)
    vi.spyOn(console, 'log').mockImplementation(() => {})

    renderHook(() => useWalletConnectGuards())

    const event = new Event('beforeunload', { cancelable: true })
    const preventSpy = vi.spyOn(event, 'preventDefault')
    Object.defineProperty(event, 'destination', {
      value: { url: 'https://rainbow.me/redirect' },
    })

    window.dispatchEvent(event)

    expect(preventSpy).toHaveBeenCalled()
    expect((event as BeforeUnloadEvent).returnValue).toBe('')
  })

  it('restores window.open on unmount', () => {
    const windowRef = {} as Window
    const openMock = vi.fn(() => windowRef)
    window.open = openMock

    const { unmount } = renderHook(() => useWalletConnectGuards())
    expect(window.open).not.toBe(openMock)

    unmount()
    expect(window.open).toBe(openMock)
  })
})
