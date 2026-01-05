// File: components/navigation/__tests__/ActiveMenuLink.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'

// 1) Mock usePathname
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))

import { usePathname } from 'next/navigation'
import ActiveMenuLink from '../menuLinks/ActiveMenuLink'

describe('<ActiveMenuLink />', () => {
  beforeEach(() => {
    // default to “not active”
    ;(usePathname as any).mockReturnValue('/')
  })

  it('renders a link with correct href & text when inactive', () => {
    render(<ActiveMenuLink text="Foo" href="/foo" />)
    const link = screen.getByRole('link', { name: 'Foo' })
    expect(link).toHaveAttribute('href', '/foo')
    expect(link).not.toHaveAttribute('aria-current')
  })

  it('adds active styles & aria-current when pathname matches', () => {
    ;(usePathname as any).mockReturnValue('/bar')
    render(<ActiveMenuLink text="Bar" href="/bar" />)
    const link = screen.getByRole('link', { name: 'Bar' })
    expect(link).toHaveAttribute('aria-current', 'page')
    // you could also check for the `styles.active` classname here
  })
})
