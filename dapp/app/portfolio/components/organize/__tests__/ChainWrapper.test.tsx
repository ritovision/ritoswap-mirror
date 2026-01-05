// __tests__/ChainWrapper.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import ChainWrapper from '../ChainWrapper'

// Stub ChainAccordion and Placeholder
vi.mock('../ChainAccordion', () => ({
  __esModule: true,
  default: () => <div data-testid="chain-accordion" />,
}))
vi.mock('../Placeholder', () => ({
  __esModule: true,
  default: () => <div data-testid="placeholder" />,
}))

describe('ChainWrapper', () => {
  it('shows Placeholder when no address or no chains', () => {
    render(<ChainWrapper chains={[]} address="" />)
    expect(screen.getByTestId('placeholder')).toBeInTheDocument()
    expect(screen.queryByTestId('chain-accordion')).toBeNull()
  })

  it('shows ChainAccordion when address & chains provided', () => {
    const chains = [{ chainId: 1, chainName: 'C1', tokens: [] }]
    render(<ChainWrapper chains={chains} address="0xABC" />)
    expect(screen.getByTestId('chain-accordion')).toBeInTheDocument()
    expect(screen.queryByTestId('placeholder')).toBeNull()
  })
})
