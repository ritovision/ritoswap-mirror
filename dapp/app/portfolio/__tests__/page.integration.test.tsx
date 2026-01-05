// app/portfolio/__tests__/page.integration.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import * as jsonld from '@lib/jsonld/loadJsonFromIndex'
import portfolioJsonLd from '../jsonld'
import Page from '../page'

// stub out PortfolioClient & Music so we only verify wiring
vi.mock('../PortfolioClient',        () => ({ __esModule: true, default: () => <div data-testid="portfolio-client" /> }))
vi.mock('../components/music/Music', () => ({ __esModule: true, default: () => <div data-testid="music" /> }))

describe('<Page /> (Portfolio)', () => {
  it('injects JSON-LD and renders client + music', () => {
    const spy = vi.spyOn(jsonld, 'loadJsonLdScripts')
    render(<Page />)

    expect(spy).toHaveBeenCalledWith(portfolioJsonLd, 'portfolio-jsonld')
    expect(screen.getByTestId('portfolio-client')).toBeInTheDocument()
    expect(screen.getByTestId('music')).toBeInTheDocument()
  })
})
