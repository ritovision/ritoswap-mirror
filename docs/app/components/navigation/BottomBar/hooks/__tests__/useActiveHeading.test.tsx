import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, cleanup, act } from '@testing-library/react'
import type { TOCItem } from '@Contexts/TOCContext'
import { useActiveHeading } from '../useActiveHeading'

type IOCallback = (entries: IntersectionObserverEntry[]) => void

class MockIO {
  cb: IOCallback
  observe = vi.fn()
  disconnect = vi.fn()
  constructor(cb: IOCallback) {
    this.cb = cb
  }
}
let lastObserver: MockIO | null = null

const makeEntry = (el: Element, isIntersecting = true): IntersectionObserverEntry => {
  const rect = el.getBoundingClientRect?.() ?? {
    x: 0, y: 0, width: 0, height: 0,
    top: 0, left: 0, right: 0, bottom: 0,
    toJSON() {}
  }
  return {
    isIntersecting,
    target: el,
    time: 0,
    rootBounds: null,
    boundingClientRect: rect as DOMRectReadOnly,
    intersectionRect: rect as DOMRectReadOnly,
    intersectionRatio: isIntersecting ? 1 : 0
  } as IntersectionObserverEntry
}

describe('useActiveHeading', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn((cb: IOCallback) => {
        lastObserver = new MockIO(cb)
        return lastObserver as unknown as IntersectionObserver
      })
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    lastObserver = null
  })

  function Harness({
    toc,
    enabled
  }: { toc?: TOCItem[]; enabled: boolean }) {
    const activeId = useActiveHeading({ toc, enabled })
    return <div data-testid="active">{activeId}</div>
  }

  it('returns empty string when disabled or no toc', () => {
    render(<Harness toc={[]} enabled={false} />)
    expect(screen.getByTestId('active').textContent).toBe('')
  })

  it('observes headings and updates active id on intersection', async () => {
    const a = document.createElement('div'); a.id = 'a'
    const b = document.createElement('div'); b.id = 'b'
    document.body.append(a, b)

    render(
      <Harness
        enabled
        toc={[
          { id: 'a', value: 'A', depth: 1 },
          { id: 'b', value: 'B', depth: 1 }
        ]}
      />
    )

    expect(lastObserver).not.toBeNull()

    await act(async () => {
      lastObserver!.cb([makeEntry(b, true)])
    })
    expect(screen.getByTestId('active').textContent).toBe('b')

    a.remove()
    b.remove()
  })

  it('disconnects observer on unmount', () => {
    const { unmount } = render(
      <Harness enabled toc={[{ id: 'x', value: 'X', depth: 1 }]} />
    )
    expect(lastObserver).not.toBeNull()
    unmount()
    expect(lastObserver!.disconnect).toHaveBeenCalled()
  })
})
