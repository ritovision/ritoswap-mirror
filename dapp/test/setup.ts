// test/setup.ts

// Mock Prisma Client before any imports
vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    $connect = vi.fn()
    $disconnect = vi.fn()
    $transaction = vi.fn()
    $extends = vi.fn(() => this)
  }
}))

import '@testing-library/jest-dom/vitest'
import React from 'react'
import { cleanup } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { alchemyHandlers } from '../app/portfolio/components/assets/__tests__/alchemyHandlers'

// Setup MSW server
export const server = setupServer(...alchemyHandlers)

/**
 * IMPORTANT:
 * Let Supertest’s in-memory HTTP server traffic pass through MSW.
 * Keep strict errors for any other unhandled requests.
 */
beforeAll(() =>
  server.listen({
    onUnhandledRequest(req, print) {
      try {
        // req.url may be a string; parse to extract hostname safely
        const url = typeof req.url === 'string' ? new URL(req.url) : req.url
        const hostname = (url as URL).hostname
        // Allow localhost/127.0.0.1 (Supertest) to bypass MSW
        if (hostname === '127.0.0.1' || hostname === 'localhost') return
      } catch {
        // If parsing fails, fall through to strict error
      }
      // Everything else must be explicitly handled
      print.error()
    },
  }),
)

// Reset handlers after each test
afterEach(() => {
  // In node test env (no DOM), avoid calling RTL cleanup which expects a DOM
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    cleanup()
  }
  server.resetHandlers()
})

// Clean up after all tests
afterAll(() => server.close())

// 2) Mock next/navigation router hooks
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({ get: vi.fn() }),
  usePathname: () => '/',
}))

// 3a) Stub next/link => <a href=…>{children}</a>
vi.mock('next/link', () => ({
  __esModule: true,
  default: (props: any) => {
    const { href, children, ...rest } = props
    return React.createElement('a', { href, ...rest }, children)
  },
}))

// 3b) Stub next/image => <img {...props}/>
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => React.createElement('img', props),
}))

// 4) Mock matchMedia for CSS-query logic (only when a browser-like window exists)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

// Mock IntersectionObserver (provide on global; also attach to window if present)
class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
;(global as any).IntersectionObserver = MockIntersectionObserver as any
if (typeof window !== 'undefined') {
  ;(window as any).IntersectionObserver = MockIntersectionObserver as any
}
