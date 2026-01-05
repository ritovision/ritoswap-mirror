// app/privacy/page.integration.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import * as jsonld from '@lib/jsonld/loadJsonFromIndex'
import jsonLdData from './jsonld'
import PrivacyPage from './page'
import '@testing-library/jest-dom'

describe('<PrivacyPage /> integration', () => {
  it('delegates JSON-LD injection to loadJsonLdScripts()', () => {
    const spy = vi.spyOn(jsonld, 'loadJsonLdScripts')
    render(<PrivacyPage />)
    expect(spy).toHaveBeenCalledWith(jsonLdData, 'privacy-jsonld')
  })

  it('renders all section headings and the contact link', () => {
    render(<PrivacyPage />)

    // Top-level title
    expect(
      screen.getByRole('heading', { level: 1 })
    ).toHaveTextContent('Privacy Policy')

    // All level-2 subtitles
    const subtitles = screen.getAllByRole('heading', { level: 2 })
                           .map(h => h.textContent)
    expect(subtitles).toEqual([
      'Information We Do Not Collect',
      'Information We Collect',
      'Blockchain Transactions',
      'No Financial Advice',
      'Intellectual Property',
      'Contact Us',
    ])

    // Mailto link
    const mailLink = screen.getByRole('link', { name: 'support@ritovision.com' })
    expect(mailLink).toHaveAttribute('href', 'mailto:support@ritovision.com')
  })
})
