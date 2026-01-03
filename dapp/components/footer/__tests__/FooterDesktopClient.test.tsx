// components/footer/__tests__/FooterDesktopClient.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import FooterDesktopClient from '../footerDesktop/FooterDesktopClient'

// Mock child components
vi.mock('../utilities/footerMenu/FooterMenuClient', () => ({
  __esModule: true,
  default: () => <div data-testid="footer-menu">Footer Menu</div>
}))
vi.mock('../utilities/footerSocials/FooterSocialsClient', () => ({
  __esModule: true,
  default: () => <div data-testid="footer-socials">Footer Socials</div>
}))
// Fix: Mock LogoArrayClient instead of CobrandClient
vi.mock('../utilities/logoArray/LogoArrayClient', () => ({
  __esModule: true,
  default: () => <div data-testid="cobrands">Cobrands</div>
}))
vi.mock('../utilities/footerLegal/FooterLegalClient', () => ({
  __esModule: true,
  default: () => <div data-testid="footer-legal">Footer Legal</div>
}))

describe('<FooterDesktopClient />', () => {
  it('renders all footer sections', () => {
    render(<FooterDesktopClient />)
    
    expect(screen.getByAltText('RitoVision Wordmark')).toBeInTheDocument()
    expect(screen.getByTestId('footer-socials')).toBeInTheDocument()
    expect(screen.getAllByTestId('footer-menu')).toHaveLength(2) // Left and right
    expect(screen.getByTestId('cobrands')).toBeInTheDocument()
    expect(screen.getByTestId('footer-legal')).toBeInTheDocument()
  })

  it('renders custom right menu content when provided', () => {
    const customContent = <div data-testid="custom-content">Custom Content</div>
    render(<FooterDesktopClient rightMenuContent={customContent} />)
    
    expect(screen.getByTestId('custom-content')).toBeInTheDocument()
    expect(screen.getAllByTestId('footer-menu')).toHaveLength(1) // Only left menu
  })

  it('logo links to home', () => {
    render(<FooterDesktopClient />)
    const logoLink = screen.getByAltText('RitoVision Wordmark').closest('a')
    expect(logoLink).toHaveAttribute('href', '/')
  })
})