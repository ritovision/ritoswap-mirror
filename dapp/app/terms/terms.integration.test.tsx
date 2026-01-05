// app/terms/page.integration.test.tsx
import React         from 'react'
import { render, screen } from '@testing-library/react'
import * as jsonld   from '@lib/jsonld/loadJsonFromIndex'
import jsonLdData    from './jsonld'
import TermsPage     from './page'
import '@testing-library/jest-dom'

describe('<TermsPage /> integration', () => {
  it('delegates JSON-LD injection to loadJsonLdScripts()', () => {
    const spy = vi.spyOn(jsonld, 'loadJsonLdScripts')
    render(<TermsPage />)
    expect(spy).toHaveBeenCalledWith(jsonLdData, 'terms-jsonld')
  })

  it('renders all section headings and the contact link', () => {
    render(<TermsPage />)

    // Level-1 title
    expect(
      screen.getByRole('heading', { level: 1 })
    ).toHaveTextContent('Terms of Service')

    // All level-2 subtitles in the right order
    const subtitles = screen.getAllByRole('heading', { level: 2 })
                               .map(h => h.textContent)
    expect(subtitles).toEqual([
      '1. Acceptance of Terms',
      '2. Use of Service',
      '3. Data & Cookies',
      '4. Blockchain Transactions',
      '5. No Financial Advice',
      '6. Intellectual Property',
      '7. Disclaimers & No Warranty',
      '8. Governing Law',
      '9. Contact',
    ])

    // Mailto link
    const mailLink = screen.getByRole('link', {
      name: 'support@ritovision.com'
    })
    expect(mailLink).toHaveAttribute(
      'href', 
      'mailto:support@ritovision.com'
    )
  })
})
