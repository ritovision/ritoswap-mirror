// dapp/app/lib/notifications/channels/__tests__/localNotification.test.ts

// Hoisted mutable env mock so we can toggle feature flags per test
const cfg = vi.hoisted(() => ({
  publicConfig: {
    features: { localNotifications: true },
  },
}))

vi.mock('@config/public.env', () => ({
  publicConfig: cfg.publicConfig,
}))

// Import after mocks
import {
  isLocalNotificationSupported,
  requestNotificationPermission,
  showLocalNotification,
  getPermissionStatus,
  closeNotificationsByTag,
} from '../localNotification'

describe('localNotification channel', () => {
  let originalNotification: any
  let originalNavigator: any
  let originalServiceWorkerRegistration: any
  let focusSpy: any
  let logSpy: any
  let errorSpy: any

  class FakeNotification {
    static permission: NotificationPermission = 'default'
    static requestPermission = vi.fn<() => Promise<NotificationPermission>>(
      async () => 'granted'
    )

    title: string
    options: any
    close = vi.fn()
    onclick?: () => void

    constructor(title: string, options: any) {
      this.title = title
      this.options = options
    }
  }

  beforeEach(() => {
    vi.useFakeTimers()

    // Save originals
    originalNotification = (globalThis as any).Notification
    originalNavigator = (globalThis as any).navigator
    originalServiceWorkerRegistration = (globalThis as any).ServiceWorkerRegistration

    // Install fakes
    ;(globalThis as any).Notification = FakeNotification as any
    ;(globalThis as any).navigator = {
      ...(originalNavigator || {}),
      serviceWorker: {
        async getRegistration() {
          return undefined
        },
      },
    }

    // Provide a proto with getNotifications so feature detection can pass when needed
    ;(globalThis as any).ServiceWorkerRegistration = function () {} as any
    ;(globalThis as any).ServiceWorkerRegistration.prototype.getNotifications = vi.fn()

    // Window focus spy
    focusSpy = vi.spyOn(window, 'focus').mockImplementation(() => {})

    // Console spies
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Defaults
    cfg.publicConfig.features.localNotifications = true
    FakeNotification.permission = 'default'
    FakeNotification.requestPermission.mockClear()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()

    // Restore globals
    ;(globalThis as any).Notification = originalNotification
    ;(globalThis as any).navigator = originalNavigator
    ;(globalThis as any).ServiceWorkerRegistration = originalServiceWorkerRegistration

    focusSpy.mockRestore()
    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('isLocalNotificationSupported returns false when feature disabled', () => {
    cfg.publicConfig.features.localNotifications = false
    expect(isLocalNotificationSupported()).toBe(false)
  })

  it('isLocalNotificationSupported returns false when Notification API missing', () => {
    // property must be deleted so `'Notification' in window` becomes false
    delete (window as any).Notification
    delete (globalThis as any).Notification
    expect(isLocalNotificationSupported()).toBe(false)
  })

  it('requestNotificationPermission returns denied when unsupported', async () => {
    cfg.publicConfig.features.localNotifications = false
    const res = await requestNotificationPermission()
    expect(res).toBe('denied')
  })

  it('requestNotificationPermission short-circuits when already granted', async () => {
    FakeNotification.permission = 'granted'
    const res = await requestNotificationPermission()
    expect(res).toBe('granted')
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled()
  })

  it('requestNotificationPermission calls Notification.requestPermission when not denied', async () => {
    FakeNotification.permission = 'default'
    FakeNotification.requestPermission.mockResolvedValueOnce('granted')
    const res = await requestNotificationPermission()
    expect(FakeNotification.requestPermission).toHaveBeenCalled()
    expect(res).toBe('granted')
  })

  it('showLocalNotification logs and returns when unsupported', async () => {
    cfg.publicConfig.features.localNotifications = false
    const res = await showLocalNotification({ title: 'Hello' })
    expect(res).toBeUndefined()
    expect(logSpy).toHaveBeenCalledWith('Local notifications are not supported or disabled')
  })

  it('showLocalNotification logs and returns when permission not granted', async () => {
    FakeNotification.permission = 'default'
    FakeNotification.requestPermission.mockResolvedValueOnce('denied')
    const res = await showLocalNotification({ title: 'Hello' })
    expect(res).toBeUndefined()
    expect(logSpy).toHaveBeenCalledWith('Notification permission not granted:', 'denied')
  })

  it('showLocalNotification creates a notification with defaults and auto-closes after 5s', async () => {
    FakeNotification.permission = 'granted'
    const notif = (await showLocalNotification({
      title: 'Hi',
      body: 'Body text',
      tag: 't1',
      // requireInteraction defaults to false, silent defaults to false
    })) as any

    expect(notif).toBeInstanceOf(FakeNotification)
    expect(notif.title).toBe('Hi')
    expect(notif.options).toMatchObject({
      body: 'Body text',
      tag: 't1',
      requireInteraction: false,
      silent: false,
      icon: '/images/SEO/favicon.png',
      badge: '/images/SEO/favicon.png',
    })

    // auto-close after 5000ms
    expect(notif.close).not.toHaveBeenCalled()
    vi.advanceTimersByTime(5000)
    expect(notif.close).toHaveBeenCalledTimes(1)
  })

  it('showLocalNotification sets onclick to focus window and close notification', async () => {
    FakeNotification.permission = 'granted'
    const notif = (await showLocalNotification({
      title: 'Click me',
      body: 'Click body',
    })) as any

    expect(typeof notif.onclick).toBe('function')
    notif.onclick!()
    expect(focusSpy).toHaveBeenCalled()
    expect(notif.close).toHaveBeenCalled()
  })

  it('showLocalNotification does not auto-close when requireInteraction is true', async () => {
    FakeNotification.permission = 'granted'
    const notif = (await showLocalNotification({
      title: 'Stay',
      requireInteraction: true,
    })) as any

    vi.advanceTimersByTime(6000)
    expect(notif.close).not.toHaveBeenCalled()
  })

  it('getPermissionStatus returns "unsupported" when feature disabled', () => {
    cfg.publicConfig.features.localNotifications = false
    expect(getPermissionStatus()).toBe('unsupported')
  })

  it('getPermissionStatus mirrors Notification.permission when supported', () => {
    FakeNotification.permission = 'denied'
    expect(getPermissionStatus()).toBe('denied')
    FakeNotification.permission = 'granted'
    expect(getPermissionStatus()).toBe('granted')
  })

  it('closeNotificationsByTag closes notifications from service worker registration', async () => {
    // Ensure feature supported for the early return check
    cfg.publicConfig.features.localNotifications = true
    FakeNotification.permission = 'granted'

    const close1 = vi.fn()
    const close2 = vi.fn()
    const getNotificationsMock = vi.fn(async (_opts?: { tag?: string }) => [
      { close: close1 },
      { close: close2 },
    ])

    // Keep prototype method truthy for feature detection
    ;(globalThis as any).ServiceWorkerRegistration.prototype.getNotifications = vi.fn()

    // Return a registration instance with getNotifications
    ;(globalThis as any).navigator = {
      ...((globalThis as any).navigator || {}),
      serviceWorker: {
        async getRegistration() {
          return {
            getNotifications: getNotificationsMock,
          } as unknown as ServiceWorkerRegistration
        },
      },
    }

    await closeNotificationsByTag('tag-1')

    expect(getNotificationsMock).toHaveBeenCalledWith({ tag: 'tag-1' })
    expect(close1).toHaveBeenCalled()
    expect(close2).toHaveBeenCalled()
  })

  it('showLocalNotification logs error if Notification constructor throws', async () => {
    FakeNotification.permission = 'granted'

    // Temporarily replace constructor to throw
    const throwingCtor = class extends FakeNotification {
      constructor(title: string, options: any) {
        super(title, options) // will never reach, but keeps TS happy
        throw new Error('boom')
      }
    }
    ;(globalThis as any).Notification = throwingCtor as any

    await showLocalNotification({ title: 'X' })
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to show notification:',
      expect.any(Error)
    )
  })
})
