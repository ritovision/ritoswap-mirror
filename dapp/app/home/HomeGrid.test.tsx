import { render, screen } from '@testing-library/react'
import HomeGrid from './HomeGrid'

class MockIntersectionObserver {
  constructor(public callback: IntersectionObserverCallback) {}
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

beforeAll(() => {
  // @ts-ignore
  window.IntersectionObserver = MockIntersectionObserver
})

afterAll(() => {
  // @ts-ignore
  delete window.IntersectionObserver
})

describe('<HomeGrid />', () => {
  it('renders cards with links, titles, descriptions, and images', () => {
    render(<HomeGrid />)

    const links = screen.getAllByRole('link')
    expect(links.length).toBeGreaterThan(0)

    links.forEach((link) => {
      expect(link).toHaveAttribute('href')
      
      expect(link.textContent).toBeTruthy()
      
      const img = link.querySelector('img')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src')
    })
  })
})