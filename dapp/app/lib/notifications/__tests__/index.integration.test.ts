// dapp/app/lib/notifications/__tests__/index.integration.test.ts

import type { Mock } from 'vitest'

// Hoisted env so local notifications are enabled
const cfg = vi.hoisted(() => ({
  publicConfig: {
    features: { localNotifications: true },
  },
}))
vi.mock('@config/public.env', () => ({
  publicConfig: cfg.publicConfig,
}))

// Mock react-hot-toast only; use real channel modules
vi.mock('react-hot-toast', () => {
  const toast = vi.fn((message?: any, options?: any) => 'id-info') as any
  toast.success = vi.fn((message?: any, options?: any) => 'id-success')
  toast.error = vi.fn((message?: any, options?: any) => 'id-error')
  toast.loading = vi.fn((message?: any, options?: any) => 'id-loading')
  toast.dismiss = vi.fn((id?: string) => {})
  toast.remove = vi.fn(() => {})
  return { default: toast }
})

// Import after mocks
import toast from 'react-hot-toast'
import {
  notifications,
  sendNotification,
  sendNotificationEvent,
  sendLoadingNotification,
  dismissLoadingNotification,
} from '../index'
import { NOTIFICATION_EVENTS } from '../events'

// Cast to a mock-friendly shape
const t = toast as unknown as {
  (message?: any, options?: any): any
  success: Mock
  error: Mock
  loading: Mock
  dismiss: Mock
  remove: Mock
  mock?: { calls: any[] }
  mockClear?: () => void
}

// Minimal fake Notification API for local notifications
class FakeNotification {
  static permission: NotificationPermission = 'default'
  static requestPermission = vi.fn<() => Promise<NotificationPermission>>(async () => 'granted')
  static instances: Array<{ title: string; options: any; close: () => void }> = []

  title: string
  options: any
  close = vi.fn()
  onclick?: () => void

  constructor(title: string, options: any) {
    this.title = title
    this.options = options
    FakeNotification.instances.push({ title, options, close: this.close })
  }
}

describe('NotificationManager integration (real channels)', () => {
  let originalNotification: any
  let logSpy: any
  let errorSpy: any

  beforeEach(() => {
    vi.useFakeTimers()

    // Save/replace globals
    originalNotification = (globalThis as any).Notification
    ;(globalThis as any).Notification = FakeNotification as any
    FakeNotification.instances = []
    FakeNotification.permission = 'granted'
    FakeNotification.requestPermission.mockClear()

    // Clear toast mocks
    t.mockClear?.()
    t.success.mockClear()
    t.error.mockClear()
    t.loading.mockClear()
    t.dismiss.mockClear()
    t.remove.mockClear()

    // Clean announcer node
    const el = document.getElementById('notification-announcer')
    if (el) el.remove()

    // Default routing
    notifications.clearHistory()
    notifications.setDefaultChannels('both')

    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    ;(globalThis as any).Notification = originalNotification
    logSpy.mockRestore()
    errorSpy.mockRestore()

    const el = document.getElementById('notification-announcer')
    if (el) el.remove()
  })

  it('sendEvent (both) triggers toast and local notification', async () => {
    await sendNotificationEvent('NFT_MINTED')

    // toast called with catalog title & success type
    expect(t.success).toHaveBeenCalledWith(
      NOTIFICATION_EVENTS.NFT_MINTED.title,
      expect.objectContaining({ position: 'bottom-right' })
    )

    // local notification constructed with defaults & body/tag
    expect(FakeNotification.instances.length).toBe(1)
    const inst = FakeNotification.instances[0]
    expect(inst.title).toBe(NOTIFICATION_EVENTS.NFT_MINTED.title)
    expect(inst.options).toMatchObject({
      body: NOTIFICATION_EVENTS.NFT_MINTED.body,
      tag: NOTIFICATION_EVENTS.NFT_MINTED.tag,
      icon: '/images/SEO/favicon.png',
      badge: '/images/SEO/favicon.png',
    })

    // announcer created by toast channel
    expect(document.getElementById('notification-announcer')).toBeTruthy()
  })

  it('loading notifications are toast-only (no local), even with default "both"', () => {
    const id = sendLoadingNotification('Working...')
    expect(id).toBe('id-loading')
    expect(t.loading).toHaveBeenCalledWith('Working...', expect.objectContaining({ position: 'bottom-right' }))
    expect(FakeNotification.instances.length).toBe(0)

    dismissLoadingNotification(id)
    expect(t.dismiss).toHaveBeenCalledWith('id-loading')
  })

  it('event overrides can force toast-only', async () => {
    await sendNotificationEvent('NFT_BURNED', { channels: 'toast' })
    expect(t.success).toHaveBeenCalledWith(
      NOTIFICATION_EVENTS.NFT_BURNED.title,
      expect.any(Object)
    )
    expect(FakeNotification.instances.length).toBe(0)
  })

  it('send() routes to local-only when requested', async () => {
    await sendNotification({
      title: 'Local title',
      body: 'Local body',
      type: 'info',
      channels: 'local',
      tag: 'x-1',
    })

    expect(t.success).not.toHaveBeenCalled()
    expect(t.error).not.toHaveBeenCalled()
    expect((t as any).mock.calls.length).toBe(0)

    expect(FakeNotification.instances.length).toBe(1)
    const inst = FakeNotification.instances[0]
    expect(inst.title).toBe('Local title')
    expect(inst.options).toMatchObject({
      body: 'Local body',
      tag: 'x-1',
    })
  })

  it('unknown events log an error and do not route', async () => {
    // @ts-expect-error invalid event name at runtime
    await sendNotificationEvent('NOT_A_REAL_EVENT')
    expect(errorSpy).toHaveBeenCalledWith('Unknown notification event: NOT_A_REAL_EVENT')
    expect(t.success).not.toHaveBeenCalled()
    expect(t.error).not.toHaveBeenCalled()
    expect(FakeNotification.instances.length).toBe(0)
  })
})
