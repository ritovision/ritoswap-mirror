// app/swap/page.integration.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import * as jsonld from '@lib/jsonld/loadJsonFromIndex'
import jsonLdData from './jsonld'
import Page from './page'
import '@testing-library/jest-dom'

// Stub out the client widget and music sub-trees,
// so this test only verifies your page wiring:
vi.mock('./components/SwapClient', () => ({ default: () => <div data-testid="swap-client"/> }))
vi.mock('./components/Music',      () => ({ default: () => <div data-testid="music"/> }))

describe('<Page /> (Swap)', () => {
  it('delegates JSON-LD injection to loadJsonLdScripts()', () => {
    const spy = vi.spyOn(jsonld, 'loadJsonLdScripts')
    render(<Page />)
    expect(spy).toHaveBeenCalledWith(jsonLdData, 'swap-jsonld')
  })

  it('renders heading, SwapClient and Music placeholders', () => {
    render(<Page />)

    expect(
      screen.getByRole('heading', { level: 1 })
    ).toHaveTextContent('Cross-Chain DEX')

    expect(screen.getByTestId('swap-client')).toBeInTheDocument()
    expect(screen.getByTestId('music')).toBeInTheDocument()
  })
})
