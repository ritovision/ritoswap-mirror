// app/portfolio/components/assets/__tests__/AssetsGrid.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import AssetsGrid from '../AssetsGrid'
import type { NFTAsset, ERC20Asset } from '../AssetDisplay'

// Stub out AssetDisplay to isolate AssetsGrid behavior
vi.mock('../AssetDisplay', () => ({
  __esModule: true,
  default: () => <div data-testid="asset-display" />,
}))

describe('AssetsGrid Component', () => {
  it('shows loading indicator when loading=true', () => {
    render(<AssetsGrid assets={[]} type="ERC-20" loading />)
    expect(screen.getByText(/Loading assets\.\.\./i)).toBeInTheDocument()
    // Use queryByTestId so it returns null if not rendered
    expect(screen.queryByTestId('asset-display')).toBeNull()
  })

  it('renders empty state when no assets and not loading', () => {
    render(<AssetsGrid assets={[]} type="ERC-721" />)
    expect(screen.getByText('No Assets Found!')).toBeInTheDocument()
  })

  it('renders one AssetDisplay per asset', () => {
    const erc20: ERC20Asset = {
      contractAddress: '0x1',
      name: 'Tkn',
      symbol: 'TKN',
      decimals: 18,
      balance: '100',
    }
    const nft: NFTAsset = {
      contractAddress: '0x2',
      tokenId: '42',
    }
    render(<AssetsGrid assets={[erc20, nft]} type="ERC-1155" />)
    const items = screen.getAllByTestId('asset-display')
    expect(items).toHaveLength(2)
  })
})
