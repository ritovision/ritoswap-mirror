// components/footer/__tests__/FooterWrapper.test.tsx
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import FooterWrapper from '../FooterWrapper'

// Mock the dynamic imports
vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<any>) => {
    const Component = ({ children, rightMenuContent }: any) => (
      <div data-testid={loader.toString().includes('Desktop') ? 'footer-desktop' : 'footer-mobile'}>
        {children || rightMenuContent}
      </div>
    )
    Component.displayName = 'DynamicComponent'
    return Component
  }
}))

// Mock ImageQuoteClient
vi.mock('../utilities/imageQuote/ImageQuoteClient', () => ({
  __esModule: true,
  default: ({ imageTextPairs }: any) => (
    <div data-testid="image-quote">
      {imageTextPairs?.[0]?.text || 'No quote'}
    </div>
  )
}))

describe('<FooterWrapper />', () => {
  beforeEach(() => {
    // Reset window size
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024
    })
  })

  it('renders desktop footer when width > 730px', () => {
    render(<FooterWrapper />)
    expect(screen.getByTestId('footer-desktop')).toBeInTheDocument()
    expect(screen.queryByTestId('footer-mobile')).not.toBeInTheDocument()
  })

  it('renders mobile footer when width <= 730px', () => {
    Object.defineProperty(window, 'innerWidth', { value: 500 })
    render(<FooterWrapper />)
    expect(screen.getByTestId('footer-mobile')).toBeInTheDocument()
    expect(screen.queryByTestId('footer-desktop')).not.toBeInTheDocument()
  })

  it('switches between mobile and desktop on resize', () => {
    const { rerender } = render(<FooterWrapper />)
    expect(screen.getByTestId('footer-desktop')).toBeInTheDocument()

    // Simulate resize to mobile
    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 500 })
      window.dispatchEvent(new Event('resize'))
    })
    rerender(<FooterWrapper />)
    expect(screen.getByTestId('footer-mobile')).toBeInTheDocument()

    // Resize back to desktop
    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 1024 })
      window.dispatchEvent(new Event('resize'))
    })
    rerender(<FooterWrapper />)
    expect(screen.getByTestId('footer-desktop')).toBeInTheDocument()
  })

  it('includes ImageQuoteClient with correct props', () => {
    render(<FooterWrapper />)
    expect(screen.getByTestId('image-quote')).toBeInTheDocument()
    expect(screen.getByText('My name ain\'t Bit, but I keep that Coin, boy')).toBeInTheDocument()
  })
})