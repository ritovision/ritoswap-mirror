import React, { useRef, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('useFocusTrap', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function setupHarness() {
    return import('../useFocusTrap').then(({ useFocusTrap }) => {
      function Harness({
        initiallyOpen = true,
        onClose = vi.fn(),
      }: { initiallyOpen?: boolean; onClose?: () => void }) {
        const [isOpen, setOpen] = useState(initiallyOpen)
        const ref = useRef<HTMLDivElement>(null)
        useFocusTrap(isOpen, ref, onClose)

        return (
          <>
            <button data-testid="outside">Outside</button>
            <div ref={ref} data-testid="container">
              <button data-testid="first">First</button>
              <a href="#" data-testid="middle">Middle link</a>
              <button data-testid="last">Last</button>
            </div>
            <button data-testid="toggle" onClick={() => setOpen(v => !v)}>Toggle</button>
          </>
        )
      }
      return { Harness }
    })
  }

  it('focuses the first focusable inside container when opened', async () => {
    const { Harness } = await setupHarness()
    render(<Harness initiallyOpen />)
    const first = screen.getByTestId('first')
    act(() => {
      vi.advanceTimersByTime(60) // initial delay
    })
    expect(document.activeElement).toBe(first)
  })

  it('cycles focus with Tab and Shift+Tab', async () => {
    const { Harness } = await setupHarness()
    render(<Harness initiallyOpen />)
    const first = screen.getByTestId('first') as HTMLButtonElement
    const last = screen.getByTestId('last') as HTMLButtonElement

    act(() => vi.advanceTimersByTime(60))
    expect(document.activeElement).toBe(first)

    act(() => {
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    })
    expect(document.activeElement).toBe(last)

    act(() => {
      fireEvent.keyDown(document, { key: 'Tab' })
    })
    expect(document.activeElement).toBe(first)
  })

  it('calls onClose when Escape is pressed', async () => {
    const { Harness } = await setupHarness()
    const onClose = vi.fn()
    render(<Harness initiallyOpen onClose={onClose} />)

    act(() => {
      vi.advanceTimersByTime(60)
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('restores focus to the previously focused element on cleanup', async () => {
    const { Harness } = await setupHarness()

    // Create a persistent outside button that won't be unmounted
    const outsideButton = document.createElement('button')
    outsideButton.setAttribute('data-testid', 'persistent-outside')
    outsideButton.textContent = 'Persistent Outside'
    document.body.appendChild(outsideButton)

    try {
      // Mount CLOSED
      const { unmount } = render(<Harness initiallyOpen={false} />)
      
      // Focus the persistent outside button
      outsideButton.focus()
      expect(document.activeElement).toBe(outsideButton)

      // Open via toggle so the hook records previousActiveElement
      fireEvent.click(screen.getByTestId('toggle'))
      act(() => vi.advanceTimersByTime(60))
      expect(document.activeElement).not.toBe(outsideButton)

      // Unmount -> focus should be restored to the persistent button
      unmount()
      expect(document.activeElement).toBe(outsideButton)
    } finally {
      // Cleanup
      document.body.removeChild(outsideButton)
    }
  })
})