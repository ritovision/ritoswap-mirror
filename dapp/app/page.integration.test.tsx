// app/page.integration.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import * as jsonld from '@lib/jsonld/loadJsonFromIndex'
import homepageJsonLd from './_data/jsonld/homepage'
import Page from './page'
import '@testing-library/jest-dom'

describe('<Page /> (Home)', () => {
  beforeEach(() => {
    vi.spyOn(jsonld, 'loadJsonLdScripts')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls loadJsonLdScripts with homepage data', () => {
    render(<Page />)
    expect(jsonld.loadJsonLdScripts).toHaveBeenCalledWith(
      homepageJsonLd,
      'homepage-jsonld'
    )
  })

it('renders the four action links with correct hrefs', () => {
  render(<Page />)
  
  const actions = [
    { label: /trade/i,  href: '/swap' },
    { label: /mint/i,   href: '/mint' },
    { label: /burn/i,   href: '/mint' },
    { label: /unlock/i, href: '/gate' },
  ] as const
  
  actions.forEach(({ label, href }) => {
    const link = screen.getByRole('link', { name: label })
    expect(link).toHaveAttribute('href', href)
  })
})
  it('renders the Crypto Music section with its content', () => {
    render(<Page />)

    expect(screen.getByText('Crypto Music')).toBeInTheDocument()
    expect(screen.getByText('Altcoin Love')).toBeInTheDocument()
    expect(
      screen.getByAltText('Altcoin Love Cover Art')
    ).toBeInTheDocument()
    expect(
      screen.getByText(/altcoins by Rito Rhymes/i)
    ).toBeInTheDocument()
  })
})
