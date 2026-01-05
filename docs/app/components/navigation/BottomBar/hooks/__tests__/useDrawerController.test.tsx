import { describe, it, beforeAll, afterAll, afterEach, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, cleanup, act, waitFor } from '@testing-library/react'

// Mock BEFORE importing the hook — and fix paths (utils is two dirs up from __tests__)
vi.mock('../../utils/dom', () => ({
  clampToDrawerCap: (n: number) => n
}))
vi.mock('../../utils/constants', () => ({
  HEIGHT_ANIM_MS: 320
}))

import { HEIGHT_ANIM_MS } from '../../utils/constants'
import { useDrawerController } from '../useDrawerController'

describe('useDrawerController', () => {
  let rafQueue: FrameRequestCallback[] = []

  beforeAll(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafQueue.push(cb)
      return rafQueue.length - 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      delete rafQueue[id]
    })
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllTimers()
    vi.useRealTimers()
    rafQueue = []
  })

  const flushRAF = async () => {
    // run all queued RAF callbacks
    for (const cb of rafQueue) cb(performance.now())
    rafQueue = []
    // allow React to commit state updates triggered inside RAF
    await act(async () => Promise.resolve())
  }

  function Harness({ hasTOC }: { hasTOC: boolean }) {
    const d = useDrawerController({ hasTOC })
    const { drawerRef, tocPanelRef, aiPanelRef, tocInnerRef, aiInnerRef } = d
    React.useEffect(() => {
      ;(window as any).__api = {
        openTOC: () => d.openDrawer('toc'),
        toggleAI: () => d.toggleAI(),
        toggleTOC: () => d.toggleTOC(),
        close: () => d.closeDrawer(),
        cancel: () => d.cancelCloseTimer()
      }
    }, [d])
    return (
      <div data-testid="root" ref={drawerRef}>
        <div data-testid="toc" ref={tocPanelRef}>
          <div data-testid="toc-inner" ref={tocInnerRef} />
        </div>
        <div data-testid="ai" ref={aiPanelRef}>
          <div data-testid="ai-inner" ref={aiInnerRef} />
        </div>
        <div data-testid="open">{String(d.isDrawerOpen)}</div>
        <div data-testid="tab">{d.activeTab}</div>
        <div data-testid="height">{String(d.drawerHeight)}</div>
      </div>
    )
  }

  const isOpen = () => screen.getByTestId('open').textContent === 'true'
  const tab = () => screen.getByTestId('tab').textContent
  const height = () => Number(screen.getByTestId('height').textContent)

  const setScrollHeight = (id: string, val: number) => {
    Object.defineProperty(screen.getByTestId(id), 'scrollHeight', {
      configurable: true,
      value: val
    })
  }

  it('does nothing when toggling TOC without TOC', () => {
    render(<Harness hasTOC={false} />)
    ;(window as any).__api.toggleTOC()
    expect(isOpen()).toBe(false)
  })

  it('opens drawer and measures height for TOC panel', async () => {
    render(<Harness hasTOC={true} />)
    setScrollHeight('toc-inner', 240)

    await act(async () => {
      ;(window as any).__api.openTOC()
    })

    expect(isOpen()).toBe(true)
    expect(tab()).toBe('toc')

    // measurement runs in RAF -> flush it
    await flushRAF()

    // wait for the DOM text to reflect the new height
    const hNode = await screen.findByTestId('height')
    expect(Number(hNode.textContent)).toBe(240)
  })

  it('toggleAI opens when closed and switches tab when open', async () => {
    render(<Harness hasTOC={true} />)
    setScrollHeight('ai-inner', 300)

    await act(async () => {
      ;(window as any).__api.toggleAI()
      await flushRAF()
    })
    expect(isOpen()).toBe(true)
    expect(tab()).toBe('ai')

    await act(async () => {
      ;(window as any).__api.toggleTOC()
      await flushRAF()
    })
    expect(tab()).toBe('toc')
  })

  it('closeDrawer animates and sets closed after timeout', async () => {
    vi.useFakeTimers()
    render(<Harness hasTOC={true} />)

    await act(async () => {
      ;(window as any).__api.openTOC()
      await flushRAF()
    })
    expect(isOpen()).toBe(true)

    await act(async () => {
      ;(window as any).__api.close()
      vi.advanceTimersByTime(HEIGHT_ANIM_MS + 5)
    })

    // ensure any setState after timeout is committed
    await act(async () => Promise.resolve())
    expect(isOpen()).toBe(false)
  })

  it('cancelCloseTimer prevents drawer from closing', async () => {
    vi.useFakeTimers()
    render(<Harness hasTOC={true} />)

    await act(async () => {
      ;(window as any).__api.openTOC()
      await flushRAF()
    })

    await act(async () => {
      ;(window as any).__api.close()
      ;(window as any).__api.cancel()
      vi.advanceTimersByTime(HEIGHT_ANIM_MS + 5)
    })

    await act(async () => Promise.resolve())
    expect(isOpen()).toBe(true)
  })
})
