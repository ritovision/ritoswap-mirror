// components/footer/__tests__/FooterLegalClient.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import versions from '@lib/versions/versions'
import FooterLegalClient from '../utilities/footerLegal/FooterLegalClient'

describe('<FooterLegalClient />', () => {
  it('renders legal links', () => {
    render(<FooterLegalClient />)

    const privacy = screen.getByText('Privacy Policy')
    const terms   = screen.getByText('Terms of Service')

    expect(privacy.closest('a')).toHaveAttribute('href', '/privacy')
    expect(terms.closest('a')).toHaveAttribute('href', '/terms')
  })

  it('displays copyright', () => {
    render(<FooterLegalClient />)

    // build the exact string using the real version and current year
    const year = new Date().getFullYear()
    const expectedText = `RitoSwap v${versions.dapp} © ${year}`
    expect(screen.getByText(expectedText)).toBeInTheDocument()
  })

  it('displays site built info with external link', () => {
    render(<FooterLegalClient />)
    const siteBuilt = screen.getByText('Site Built by RitoVision with Next.js')
    const link      = siteBuilt.closest('a')

    expect(link).toHaveAttribute('href', 'https://ritovision.com')
    expect(link).toHaveAttribute('target', '_blank')
  })
})
