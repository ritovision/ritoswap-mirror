// components/footer/__tests__/LogoArrayClient.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import LogoArrayClient from '../utilities/logoArray/LogoArrayClient'

describe('<LogoArray />', () => {
  it('renders Co-Brands heading', () => {
    render(<LogoArrayClient />)
    expect(screen.getByRole('heading', { name: 'Co-Brands' })).toBeInTheDocument()
  })

  it('renders all LogoArray images with correct links', () => {
    render(<LogoArrayClient />)
    
    const ritovision = screen.getByAltText('Ritovision')
    const ritography = screen.getByAltText('Ritography')
    const ritorhymes = screen.getByAltText('RitoRhymes')
    
    expect(ritovision).toBeInTheDocument()
    expect(ritography).toBeInTheDocument()
    expect(ritorhymes).toBeInTheDocument()
    
    // Check links
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', 'https://ritovision.com')
    expect(links[1]).toHaveAttribute('href', 'https://ritography.com')
    expect(links[2]).toHaveAttribute('href', 'https://ritorhymes.com')
    
    // All external links
    links.forEach(link => {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })
})