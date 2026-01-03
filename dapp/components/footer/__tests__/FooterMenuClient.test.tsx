// components/footer/__tests__/FooterMenuClient.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import FooterMenuClient from '../utilities/footerMenu/FooterMenuClient'

describe('<FooterMenuClient />', () => {
  it('renders all menu links', () => {
    render(<FooterMenuClient />)
    
    const expectedLinks = ['Home', 'Swap', 'Mint', 'Gate', 'Portfolio']
    expectedLinks.forEach(label => {
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  it('links have correct hrefs', () => {
    render(<FooterMenuClient />)
    
    expect(screen.getByText('Home').closest('a')).toHaveAttribute('href', '/')
    expect(screen.getByText('Swap').closest('a')).toHaveAttribute('href', '/swap')
    expect(screen.getByText('Mint').closest('a')).toHaveAttribute('href', '/mint')
    expect(screen.getByText('Gate').closest('a')).toHaveAttribute('href', '/gate')
    expect(screen.getByText('Portfolio').closest('a')).toHaveAttribute('href', '/portfolio')
  })

  it('displays the "Menu" heading with correct aria-label', () => {
    render(<FooterMenuClient />)

    // visible text
    expect(screen.getByText('Menu')).toBeInTheDocument()

    // accessible name via aria-label on the heading
    expect(
      screen.getByRole('heading', { name: 'Navigation menu section' })
    ).toBeInTheDocument()
  })
})
