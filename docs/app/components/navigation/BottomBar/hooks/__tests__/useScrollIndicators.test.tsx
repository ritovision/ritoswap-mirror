import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
import React from 'react'
import { render, cleanup, act, screen } from '@testing-library/react'
import { useScrollIndicators } from '../useScrollIndicators'

function Harness(props?: { isDrawerOpen?: boolean; onScroll?: () => void }) {
  const { isNearFooter, scrollButtonsProps } = useScrollIndicators({
    isDrawerOpen: props?.isDrawerOpen,
    onScrollInteraction: props?.onScroll
  })

  // expose current flags via DOM
  return (
    <div>
      <div data-testid="top">{String(scrollButtonsProps.isAtTop)}</div>
      <div data-testid="bottom">{String(scrollButtonsProps.isAtBottom)}</div>
      <div data-testid="near">{String(isNearFooter)}</div>
      <div data-testid="upSticky">{String(scrollButtonsProps.scrollUpSticky)}</div>
      <div data-testid="downSticky">{String(scrollButtonsProps.scrollDownSticky)}</div>

      {/* expose actions via window to avoid stale closures */}
      <button
        data-testid="up"
        onClick={() => scrollButtonsProps.onScrollUp()}
      />
      <button
        data-testid="down"
        onClick={() => scrollButtonsProps.onScrollDown()}
      />
      <button
        data-testid="upEnter"
        onClick={() => scrollButtonsProps.onScrollUpMouseEnter()}
      />
      <button
        data-testid="upLeave"
        onClick={() => scrollButtonsProps.onScrollUpMouseLeave()}
      />
    </div>
  )
}

const bool = (testId: string) => screen.getByTestId(testId).textContent === 'true'

describe('useScrollIndicators', () => {
  let scrollToSpy: any
  let innerHeightSpy: any
  let scrollYGetter: any
  const setDocHeight = (h: number) =>
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: h
    })
  const setScrollY = (y: number) => {
    scrollYGetter.mockReturnValue(y)
  }

  beforeEach(() => {
    cleanup()
    scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    innerHeightSpy = vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(500)
    scrollYGetter = vi.spyOn(window, 'scrollY', 'get').mockReturnValue(0)
    setDocHeight(2000)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    scrollToSpy.mockRestore()
    innerHeightSpy.mockRestore()
    scrollYGetter.mockRestore()
  })

  it('computes top/bottom/footer flags from scroll', () => {
    render(<Harness />)
    expect(bool('top')).toBe(true)

    setScrollY(1600)
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(bool('bottom')).toBe(true)
  })

  it('isNearFooter suppressed when drawer is open', () => {
    render(<Harness isDrawerOpen />)

    setScrollY(1800)
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(bool('near')).toBe(false)
  })

  it('scrollToTop/Bottom call callback and clear sticky when thresholds met', async () => {
    vi.useFakeTimers()
    const onScroll = vi.fn()
    render(<Harness onScroll={onScroll} />)

    // up
    await act(async () => {
      screen.getByTestId('up').click()
    })
    expect(onScroll).toHaveBeenCalled()
    expect(bool('upSticky')).toBe(true)

    // When at top, effect schedules fade reset; advance timers to clear
    await act(async () => {
      vi.runOnlyPendingTimers()
    })
    expect(bool('upSticky')).toBe(false)

    // down -> become bottom -> clear after timers
    await act(async () => {
      screen.getByTestId('down').click()
    })
    expect(onScroll).toHaveBeenCalledTimes(2)
    expect(bool('downSticky')).toBe(true)

    setScrollY(1500) // 1500 + 500 = 2000 == bottom
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
    await act(async () => {
      vi.runOnlyPendingTimers()
    })
    expect(bool('downSticky')).toBe(false)

    vi.useRealTimers()
  })

  it('hover callbacks flip hover flags (smoke via no-throw)', () => {
    render(<Harness />)
    act(() => {
      screen.getByTestId('upEnter').click()
      screen.getByTestId('upLeave').click()
    })
  })
})
