// components/footer/__tests__/ImageQuoteClient.test.tsx
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import ImageQuoteClient from '../utilities/imageQuote/ImageQuoteClient'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/test-path'
}))

describe('<ImageQuoteClient />', () => {
  const mockPairs = [
    { image: '/images/quote1.jpg', text: 'Quote 1' },
    { image: '/images/quote2.jpg', text: 'Quote 2' }
  ]

  beforeEach(() => {
    // Mock IntersectionObserver constructor that stores its callback on the instance
    const MockIO: any = vi.fn().mockImplementation(function (this: any, cb: IntersectionObserverCallback) {
      // store callback on instance for later invocation
      this.cb = cb
    })

    // Annotate `this` for observe to avoid TS implicit-any on `this`
    MockIO.prototype.observe = function (this: any, el: Element) {
      const cb = this.cb as IntersectionObserverCallback | undefined
      if (typeof cb === 'function') {
        // Simulate a single entry that intersects
        const entry = { isIntersecting: true, target: el } as unknown as IntersectionObserverEntry
        cb([entry], this as unknown as IntersectionObserver)
      }
    }

    MockIO.prototype.unobserve = vi.fn()
    MockIO.prototype.disconnect = vi.fn()

    // attach to global so component uses it
    ;(global as any).IntersectionObserver = MockIO
  })

  afterEach(() => {
    // clean up global and restore mocks
    delete (global as any).IntersectionObserver
    vi.restoreAllMocks()
  })

  it('renders loading state when no pairs provided', () => {
    render(<ImageQuoteClient imageTextPairs={[]} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders a random image-text pair', async () => {
    // deterministic randomness
    vi.spyOn(Math, 'random').mockReturnValue(0.1)

    render(<ImageQuoteClient imageTextPairs={mockPairs} />)

    // findBy* will wait for the element to appear
    const img = await screen.findByAltText('Quote 1')
    expect(img).toBeInTheDocument()

    const quote = await screen.findByText(/Quote \d/)
    expect(quote).toBeInTheDocument()
  })

  it('wraps text in quotes', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // deterministic pick
    render(
      <ImageQuoteClient
        imageTextPairs={[{ image: '/test.jpg', text: 'Test quote' }]}
      />
    )

    const wrapped = await screen.findByText('"Test quote"')
    expect(wrapped).toBeInTheDocument()
  })

  it('sets up intersection observer', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(<ImageQuoteClient imageTextPairs={mockPairs} />)

    await screen.findByAltText('Quote 1')
    await waitFor(() => {
      expect((global as any).IntersectionObserver).toHaveBeenCalled()
    })
  })
})
