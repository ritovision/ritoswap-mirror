import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
import React, { useRef } from 'react'
import { cleanup, render, act, waitFor, screen } from '@testing-library/react'

// define your top-level mock variable first
let nativeBtn: HTMLButtonElement | null = null

// vitest hoists mocks to top — everything they use must already exist
vi.mock('../../utils/dom', () => ({
  findNativeSidebarButton: () => nativeBtn
}))

import { useSidebarBridge } from '../useSidebarBridge'

function Harness() {
  const barRef = useRef<HTMLDivElement>(null)
  const { sidebarExpanded, toggleSidebar } = useSidebarBridge({
    barRef: barRef as React.RefObject<HTMLDivElement>
  })
  return (
    <div>
      <div data-testid="bar" ref={barRef} />
      <div data-testid="expanded">{String(sidebarExpanded)}</div>
      <button data-testid="toggle" onClick={toggleSidebar} />
    </div>
  )
}

const expandedText = () => screen.getByTestId('expanded').textContent ?? ''

describe('useSidebarBridge (relaxed)', () => {
  beforeEach(() => {
    cleanup()
    nativeBtn = document.createElement('button')
    nativeBtn.setAttribute('aria-controls', 'sidebar')
    nativeBtn.setAttribute('aria-expanded', 'false')
    document.body.appendChild(nativeBtn)
  })

  afterEach(() => {
    cleanup()
    nativeBtn?.remove()
    nativeBtn = null
    vi.clearAllMocks()
  })

  it('reflects native sidebar state and responds to mutations', async () => {
    render(<Harness />)

    // flush effects & reattach on resize
    await act(async () => Promise.resolve())
    await act(async () => {
      window.dispatchEvent(new Event('resize'))
    })

    await waitFor(() => {
      expect(['true', 'false']).toContain(expandedText())
    })
    expect(expandedText()).toBe('false')

    // simulate MutationObserver behavior manually
    nativeBtn!.setAttribute('aria-expanded', 'true')
    await waitFor(() => expect(expandedText()).toBe('true'))
  })

  it('clicks native button and updates after attribute change', async () => {
    const clickSpy = vi.spyOn(nativeBtn!, 'click')
    render(<Harness />)

    await act(async () => Promise.resolve())
    await act(async () => {
      window.dispatchEvent(new Event('resize'))
    })
    await waitFor(() => expect(expandedText()).toBe('false'))

    // trigger toggle
    await act(async () => {
      screen.getByTestId('toggle').click()
    })
    expect(clickSpy).toHaveBeenCalled()

    // Simulate the attribute change that would happen from the real click
    nativeBtn!.setAttribute('aria-expanded', 'true')

    // Wait for MutationObserver to fire and update state
    await waitFor(() => expect(expandedText()).toBe('true'))
  })

  it('dispatches custom event when no native button is found', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    nativeBtn = null

    render(<Harness />)
    await act(async () => {
      screen.getByTestId('toggle').click()
    })

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'nextra:toggleSidebar' })
    )
  })
})
