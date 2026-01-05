// dapp/app/lib/notifications/channels/__tests__/toast.test.ts

import type { Mock } from 'vitest'

// ✅ Mock react-hot-toast with a proper default export that is also callable
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
import { showToast, dismissToast, removeAllToasts } from '../toast'

// Cast to a mock-friendly shape so TS accepts .mock / .mockClear
const t = toast as unknown as {
  (message?: any, options?: any): any
  success: Mock
  error: Mock
  loading: Mock
  dismiss: Mock
  remove: Mock
  mock?: { calls: any[] } // base callable's vi.fn metadata
  mockClear?: () => void
}

describe('toast channel (react-hot-toast wrapper)', () => {
  let originalDocument: any

  beforeEach(() => {
    vi.useFakeTimers()
    // Clean up any announcer left from previous tests
    const el = globalThis.document?.getElementById('notification-announcer')
    if (el) el.remove()
    t.mockClear?.()
    t.success.mockClear()
    t.error.mockClear()
    t.loading.mockClear()
    t.dismiss.mockClear()
    t.remove.mockClear()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    if (originalDocument) {
      ;(globalThis as any).document = originalDocument
      originalDocument = null
    }
    const el = globalThis.document?.getElementById('notification-announcer')
    if (el) el.remove()
  })

  it('routes success to toast.success with correct options and styles', () => {
    const id = showToast({ message: 'Yay', type: 'success', duration: 3210 })
    expect(id).toBe('id-success')
    expect(t.success).toHaveBeenCalledTimes(1)
    const [msg, opts] = t.success.mock.calls[0]
    expect(msg).toBe('Yay')
    expect(opts.position).toBe('bottom-right')
    expect(opts.duration).toBe(3210)
    expect(opts.style).toMatchObject({
      background: 'var(--primary-color)',
      color: 'white',
      border: '2px solid var(--utility-green)',
    })
  })

  it('routes error to toast.error with correct options and styles', () => {
    const id = showToast({ message: 'Oops', type: 'error', duration: 5555 })
    expect(id).toBe('id-error')
    const [msg, opts] = t.error.mock.calls[0]
    expect(msg).toBe('Oops')
    expect(opts.position).toBe('bottom-right')
    expect(opts.duration).toBe(5555)
    expect(opts.style).toMatchObject({
      background: 'black',
      color: 'white',
      border: '2px solid var(--accent-color)',
    })
  })

  it('routes loading to toast.loading without duration and with styles', () => {
    const id = showToast({ message: 'Loading…', type: 'loading' })
    expect(id).toBe('id-loading')
    const [msg, opts] = t.loading.mock.calls[0]
    expect(msg).toBe('Loading…')
    expect(opts.position).toBe('bottom-right')
    // duration should not be present for loading variant
    expect('duration' in opts).toBe(false)
    expect(opts.style).toMatchObject({
      background: 'var(--primary-color)',
      color: 'white',
    })
  })

  it('routes info/default to base toast callable with correct options and styles', () => {
    const id = showToast({ message: 'Hi', type: 'info', duration: 1234 })
    expect(id).toBe('id-info')
    const [msg, opts] = (t as any).mock.calls[0]
    expect(msg).toBe('Hi')
    expect(opts.position).toBe('bottom-right')
    expect(opts.duration).toBe(1234)
    expect(opts.style).toMatchObject({
      background: 'var(--primary-color)',
      color: 'white',
    })
  })

  it('announces to screen readers with proper roles and cleans up after 1s (error)', () => {
    showToast({ message: 'Bad!', type: 'error' })
    const container = document.getElementById('notification-announcer')!
    expect(container).toBeTruthy()
    // Should contain exactly one announcement node
    expect(container.childElementCount).toBe(1)
    const announcement = container.firstElementChild as HTMLElement
    expect(announcement.getAttribute('role')).toBe('alert')
    expect(announcement.getAttribute('aria-live')).toBe('assertive')
    expect(announcement.textContent).toBe('Error: Bad!')
    // After 1s, the announcement element is removed (container stays)
    vi.advanceTimersByTime(1000)
    expect(container.childElementCount).toBe(0)
  })

  it('announces with status role for success/info and the correct prefixes', () => {
    showToast({ message: 'Great', type: 'success' })
    let container = document.getElementById('notification-announcer')!
    let announcement = container.firstElementChild as HTMLElement
    expect(announcement.getAttribute('role')).toBe('status')
    expect(announcement.getAttribute('aria-live')).toBe('polite')
    expect(announcement.textContent).toBe('Success: Great')
    // info
    vi.advanceTimersByTime(1000)
    showToast({ message: 'Heads up', type: 'info' })
    container = document.getElementById('notification-announcer')!
    announcement = container.firstElementChild as HTMLElement
    expect(announcement.getAttribute('role')).toBe('status')
    expect(announcement.getAttribute('aria-live')).toBe('polite')
    expect(announcement.textContent).toBe('Heads up')
  })

  it('SSR safety: does not touch DOM when document is undefined', () => {
    originalDocument = (globalThis as any).document
    ;(globalThis as any).document = undefined
    showToast({ message: 'SSR-safe', type: 'info' })
    expect(originalDocument?.getElementById('notification-announcer')).toBeNull()
  })

  it('dismissToast with id and without id delegates to toast.dismiss', () => {
    dismissToast('abc')
    expect(t.dismiss).toHaveBeenCalledWith('abc')
    dismissToast()
    // last call should be with no args
    const lastCall = t.dismiss.mock.calls.at(-1)!
    expect(lastCall.length).toBe(0)
  })

  it('removeAllToasts delegates to toast.remove', () => {
    removeAllToasts()
    expect(t.remove).toHaveBeenCalledTimes(1)
  })
})
