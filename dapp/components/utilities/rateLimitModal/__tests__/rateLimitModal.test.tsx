// dapp/components/utilities/wallet/__tests__/rateLimitModal.test.tsx
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import {
  default as RateLimitModal,
  RateLimitModalProvider,
  showRateLimitModal,
} from '../RateLimitModal'

describe('RateLimitModal (standalone)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('renders when visible, shows details, and auto-hides after 3s + 300ms (calls onClose)', () => {
    const onClose = vi.fn()

    render(
      <RateLimitModal
        isVisible
        remaining={0}
        retryAfter={120}
        limit={10}
        onClose={onClose}
      />
    )

    // Appears immediately
    expect(
      screen.getByRole('heading', { name: /too many requests/i })
    ).toBeInTheDocument()

    // Message shows "in 120 seconds" when remaining === 0
    expect(
      screen.getByText(/in 120 seconds/i)
    ).toBeInTheDocument()

    // Limit line rendered
    expect(
      screen.getByText(/limit:\s*10 requests per minute/i)
    ).toBeInTheDocument()

    // After 3s it starts fade-out, and after +300ms it unmounts and calls onClose
    act(() => {
      vi.advanceTimersByTime(3000) // trigger fade-out start
      vi.advanceTimersByTime(300)  // complete fade-out/remove
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByRole('heading', { name: /too many requests/i })
    ).toBeNull()
  })

  it('shows remaining message when remaining > 0', () => {
    render(<RateLimitModal isVisible remaining={3} />)
    expect(
      screen.getByText(/you have 3 requests remaining/i)
    ).toBeInTheDocument()
  })
})

describe('RateLimitModalProvider + showRateLimitModal (singleton)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('shows via singleton, replaces existing modal on subsequent calls, and auto-hides', () => {
    render(
      <RateLimitModalProvider>
        <div data-testid="child" />
      </RateLimitModalProvider>
    )

    // First show
    act(() => {
      showRateLimitModal({ remaining: 0, retryAfter: 60, limit: 5 })
      vi.advanceTimersByTime(100) // provider's show delay
    })

    expect(
      screen.getByRole('heading', { name: /too many requests/i })
    ).toBeInTheDocument()
    expect(screen.getByText(/in 60 seconds/i)).toBeInTheDocument()
    expect(
      screen.getByText(/limit:\s*5 requests per minute/i)
    ).toBeInTheDocument()

    // Second show replaces content quickly
    act(() => {
      showRateLimitModal({ remaining: 2 })
      vi.advanceTimersByTime(100) // allow remount/update
    })

    // New content visible, old "in 60 seconds" gone
    expect(
      screen.getByText(/you have 2 requests remaining/i)
    ).toBeInTheDocument()
    expect(screen.queryByText(/in 60 seconds/i)).toBeNull()

    // Auto-hide after 3s + 300ms
    act(() => {
      vi.advanceTimersByTime(3000)
      vi.advanceTimersByTime(300)
    })

    expect(
      screen.queryByRole('heading', { name: /too many requests/i })
    ).toBeNull()
  })
})
