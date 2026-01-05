// dapp/app/lib/notifications/__tests__/index.test.ts

import type { Mock } from 'vitest'

// Hoisted channel mocks so we can assert calls
const ch = vi.hoisted(() => {
  return {
    showToast: vi.fn(() => 'toast-id') as unknown as Mock,
    dismissToast: vi.fn() as unknown as Mock,
    showLocalNotification: vi.fn(async () => undefined) as unknown as Mock,
  }
})

vi.mock('../channels/toast', () => ({
  showToast: ch.showToast,
  dismissToast: ch.dismissToast,
}))

vi.mock('../channels/localNotification', () => ({
  showLocalNotification: ch.showLocalNotification,
}))

// Import after mocks
import {
  notifications,
  sendNotification,
  sendNotificationEvent,
  sendSuccessNotification,
  sendErrorNotification,
  sendInfoNotification,
  sendLoadingNotification,
  dismissLoadingNotification,
} from '../index'
import { NOTIFICATION_EVENTS } from '../events'

describe('NotificationManager (index.ts)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    ch.showToast.mockReset()
    ch.dismissToast.mockReset()
    ch.showLocalNotification.mockReset()
    notifications.clearHistory()
    notifications.setDefaultChannels('both')
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
  })

  it('send(): routes to toast-only when channels="toast"', async () => {
    await sendNotification({
      title: 'Hello',
      body: 'ignored',
      type: 'info',
      channels: 'toast',
      duration: 123,
    })

    expect(ch.showToast).toHaveBeenCalledWith({
      message: 'Hello',
      type: 'info',
      duration: 123,
    })
    expect(ch.showLocalNotification).not.toHaveBeenCalled()

    const history = notifications.getHistory()
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      title: 'Hello',
      type: 'info',
      channels: 'toast',
      source: 'system',
    })
    expect(typeof history[0].timestamp).toBe('number')
  })

  it('send(): routes to local-only when channels="local"', async () => {
    await sendNotification({
      title: 'Local only',
      body: 'Body text',
      type: 'success',
      channels: 'local',
      tag: 'tag-1',
    })

    expect(ch.showToast).not.toHaveBeenCalled()
    expect(ch.showLocalNotification).toHaveBeenCalledWith({
      title: 'Local only',
      body: 'Body text',
      tag: 'tag-1',
    })
  })

  it('send(): routes to both when channels="both"', async () => {
    await sendNotification({
      title: 'Both routes',
      type: 'success',
      channels: 'both',
    })

    expect(ch.showToast).toHaveBeenCalledTimes(1)
    expect(ch.showLocalNotification).toHaveBeenCalledTimes(1)
  })

  it('loading(): shows toast only and returns id; dismiss() passes through', () => {
    const id = sendLoadingNotification('Working...')
    expect(id).toBe('toast-id')
    expect(ch.showToast).toHaveBeenCalledWith({
      message: 'Working...',
      type: 'loading',
      duration: undefined,
    })
    expect(ch.showLocalNotification).not.toHaveBeenCalled()

    dismissLoadingNotification(id)
    expect(ch.dismissToast).toHaveBeenCalledWith('toast-id')

    const history = notifications.getHistory()
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      title: 'Working...',
      type: 'loading',
      channels: 'toast',
    })
  })

  it('success()/error()/info() delegate to send() with correct type', async () => {
    await sendSuccessNotification('All good', 'Body!')
    await sendErrorNotification('Oops', 'Uh oh')
    await sendInfoNotification('FYI', 'Some info', { channels: 'toast' })

    // success defaults to both (by manager default)
    expect(ch.showToast).toHaveBeenCalledWith({
      message: 'All good',
      type: 'success',
      duration: undefined,
    })
    expect(ch.showLocalNotification).toHaveBeenCalledWith({
      title: 'All good',
      body: 'Body!',
      tag: undefined,
    })

    // error also routes to both by default
    expect(ch.showToast).toHaveBeenCalledWith({
      message: 'Oops',
      type: 'error',
      duration: undefined,
    })
    expect(ch.showLocalNotification).toHaveBeenCalledWith({
      title: 'Oops',
      body: 'Uh oh',
      tag: undefined,
    })

    // info with channels override toast-only
    expect(ch.showToast).toHaveBeenCalledWith({
      message: 'FYI',
      type: 'info',
      duration: undefined,
    })
  })

  it('sendEvent(): uses catalog defaults (both) and logs event name', async () => {
    // NFT_MINTED defaults: type success, channels both
    await sendNotificationEvent('NFT_MINTED')

    expect(ch.showToast).toHaveBeenCalledWith({
      message: NOTIFICATION_EVENTS.NFT_MINTED.title,
      type: 'success',
      duration: undefined,
    })
    expect(ch.showLocalNotification).toHaveBeenCalledWith({
      title: NOTIFICATION_EVENTS.NFT_MINTED.title,
      body: NOTIFICATION_EVENTS.NFT_MINTED.body,
      tag: NOTIFICATION_EVENTS.NFT_MINTED.tag,
    })

    const history = notifications.getHistory()
    // sendEvent logs once inside send(), then again with the event name
    expect(history.length).toBe(2)
    expect(history.at(-1)).toMatchObject({
      title: NOTIFICATION_EVENTS.NFT_MINTED.title,
      event: 'NFT_MINTED',
    })
  })

  it('sendEvent(): allows overrides (e.g., force toast-only, custom duration)', async () => {
    await sendNotificationEvent('NFT_BURNED', { channels: 'toast', duration: 999 })

    expect(ch.showToast).toHaveBeenCalledWith({
      message: NOTIFICATION_EVENTS.NFT_BURNED.title,
      type: 'success',
      duration: 999,
    })
    expect(ch.showLocalNotification).not.toHaveBeenCalled()
  })

  it('setDefaultChannels(): affects subsequent send() calls without explicit channels', async () => {
    notifications.setDefaultChannels('local')
    await sendNotification({ title: 'Default local', type: 'info' })

    expect(ch.showToast).not.toHaveBeenCalled()
    expect(ch.showLocalNotification).toHaveBeenCalledWith({
      title: 'Default local',
      body: undefined,
      tag: undefined,
    })
  })

  it('sendEvent(): unknown event logs an error and does nothing', async () => {
    // @ts-expect-error: simulate an invalid event name at runtime
    await sendNotificationEvent('NOT_A_REAL_EVENT')

    expect(errorSpy).toHaveBeenCalledWith('Unknown notification event: NOT_A_REAL_EVENT')
    expect(ch.showToast).not.toHaveBeenCalled()
    expect(ch.showLocalNotification).not.toHaveBeenCalled()
    expect(notifications.getHistory()).toHaveLength(0)
  })

  it('history is capped at 100 entries and returned as a shallow copy', async () => {
    // make it fast: toast only to avoid awaiting local
    for (let i = 0; i < 105; i++) {
      await sendNotification({ title: `t${i}`, type: 'info', channels: 'toast' })
    }
    const history = notifications.getHistory()
    expect(history).toHaveLength(100)
    expect(history[0].title).toBe('t5') // first 5 entries trimmed

    // shallow copy: pushing to returned array doesn't mutate manager
    history.push({
      title: 'fake',
      type: 'info',
      channels: 'toast',
      source: 'system',
      timestamp: Date.now(),
    } as any)
    expect(notifications.getHistory()).toHaveLength(100)
  })

  it('loading never triggers local even when default/both is set', () => {
    notifications.setDefaultChannels('both')
    const id = sendLoadingNotification('Long task')
    expect(id).toBe('toast-id')
    expect(ch.showLocalNotification).not.toHaveBeenCalled()
  })
})
