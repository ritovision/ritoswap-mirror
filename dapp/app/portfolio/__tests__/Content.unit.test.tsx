// app/portfolio/__tests__/Content.unit.test.tsx
// @ts-nocheck
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { Content } from '../PortfolioClient'

// 1) Stub ChainInfoProvider
vi.mock('@/components/providers/ChainInfoProvider', () => ({
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
  default: ({ chains, address }: any) => (
    <div data-testid="chain-wrapper">
      {chains.map((c: any) => (
        <div key={c.chainId}>
          {c.chainName} @ {address}
        </div>
      ))}
    </div>
  ),
}))

describe('Content mapping logic', () => {
  it('renders ChainWrapper with correct chainData', () => {
    render(
      <Content
        selectedAccount="0x123"
        onAccountChange={() => {}}
        selectedChains={[1, 2]}
        onChainsChange={() => {}}
        selectedTokens={[]} // empty to satisfy TokenType
        onTokensChange={() => {}}
      />
    )

    expect(screen.getByTestId('chain-wrapper')).toBeInTheDocument()
    expect(screen.getByText('Chain-1 @ 0x123')).toBeInTheDocument()
    expect(screen.getByText('Chain-2 @ 0x123')).toBeInTheDocument()
  })
})
