import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'
import React from 'react'

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...rest }: { src: unknown; alt?: string }) => {
    const resolvedSrc =
      typeof src === 'string'
        ? src
        : typeof src === 'object' && src !== null && 'src' in src
          ? (src as { src?: string }).src ?? ''
          : ''

    return React.createElement('img', { src: resolvedSrc, alt: alt ?? '', ...rest })
  }
}))

if (!('matchMedia' in window)) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
}

class ResizeObserverStub implements ResizeObserver {
  callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (!('ResizeObserver' in window)) {
  // @ts-expect-error - assigning to window
  window.ResizeObserver = ResizeObserverStub
}
