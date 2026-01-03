import { render, screen } from '@testing-library/react'
import React from 'react'
import LinkRenderer from '../LinkRenderer'

describe('LinkRenderer', () => {
  it('renders an anchor with label text and aria-label', () => {
    render(<LinkRenderer label="Docs" href="https://example.com" role="assistant" />)
    const link = screen.getByRole('link', { name: 'Docs' }) as HTMLAnchorElement
    expect(link).toBeInTheDocument()
    expect(link.textContent).toBe('Docs')
    expect(link.getAttribute('aria-label')).toBe('Docs')
  })

  it('allows only http(s) hrefs; otherwise uses "#"', () => {
    const { rerender } = render(
      <LinkRenderer label="ok" href="http://example.com" role="user" />
    )
    let link = screen.getByRole('link', { name: 'ok' }) as HTMLAnchorElement
    expect(link.href.startsWith('http://example.com')).toBe(true)

    rerender(<LinkRenderer label="secure" href="https://example.com" role="assistant" />)
    link = screen.getByRole('link', { name: 'secure' }) as HTMLAnchorElement
    expect(link.href.startsWith('https://example.com')).toBe(true)

    // disallowed schemes/paths → '#'
    rerender(<LinkRenderer label="bad1" href="javascript:alert(1)" role="user" />)
    link = screen.getByRole('link', { name: 'bad1' }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('#')

    rerender(<LinkRenderer label="bad2" href="mailto:test@example.com" role="assistant" />)
    link = screen.getByRole('link', { name: 'bad2' }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('#')

    rerender(<LinkRenderer label="bad3" href="/relative/path" role="user" />)
    link = screen.getByRole('link', { name: 'bad3' }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('#')
  })

  it('sets target and rel for safety', () => {
    render(<LinkRenderer label="Docs" href="https://example.com" role="assistant" />)
    const link = screen.getByRole('link', { name: 'Docs' }) as HTMLAnchorElement
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })
})
