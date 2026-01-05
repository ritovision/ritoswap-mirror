// app/portfolio/__tests__/PortfolioClient.integration.test.tsx
// @ts-nocheck
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import PortfolioClient from '../PortfolioClient'

// 1) Stub ChainInfoProvider and useChainInfo
vi.mock('@/components/providers/ChainInfoProvider', () => ({
  __esModule: true,
  ChainInfoProvider: ({ children }: any) => (
    <div data-testid="chain-info-provider">{children}</div>
  ),
  useChainInfo: () => ({
    getChainDisplayName: (id: number) => `Chain-${id}`,
  }),
}))

// 2) Stub child components
vi.mock('../components/selection/SelectAccount', () => ({
  __esModule: true,
  default: () => <div data-testid="acct" />,
}))
vi.mock('../components/selection/SelectChain', () => ({
  __esModule: true,
  default: () => <div data-testid="chain-select" />,
}))
vi.mock('../components/selection/SelectToken', () => ({
  __esModule: true,
  default: () => <div data-testid="token-select" />,
}))
vi.mock('../components/organize/ChainWrapper', () => ({
  __esModule: true,
  default: () => <div data-testid="chain-wrapper" />,
}))

describe('<PortfolioClient /> integration under ChainInfoProvider', () => {
  it('renders all sub-components inside ChainInfoProvider', () => {
    render(<PortfolioClient />)

    // Ensure we're wrapped in the new provider
    expect(screen.getByTestId('chain-info-provider')).toBeInTheDocument()

    // And all children render as before
    expect(screen.getByTestId('acct')).toBeInTheDocument()
    expect(screen.getByTestId('chain-select')).toBeInTheDocument()
    expect(screen.getByTestId('token-select')).toBeInTheDocument()
    expect(screen.getByTestId('chain-wrapper')).toBeInTheDocument()
  })
})
