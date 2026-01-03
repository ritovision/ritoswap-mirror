// app/portfolio/components/assets/__tests__/AssetDisplay.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import AssetDisplay, { ERC20Asset, NFTAsset } from '../AssetDisplay'

describe('AssetDisplay – ERC20Display', () => {
  it('formats and shows name, symbol, balance and value', () => {
    const asset: ERC20Asset = {
      contractAddress: '0xAAA',
      name: 'My Token',
      symbol: 'MTK',
      decimals: 18,
      balance: (BigInt(5_000_000_000_000_000_000).toString()), // 5 tokens
      price: 2.5,
    }
    render(<AssetDisplay asset={asset} type="ERC-20" />)

    expect(screen.getByRole('heading', { name: /My Token/ })).toBeInTheDocument()
    expect(screen.getByText('MTK')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('$12.50')).toBeInTheDocument()
  })

  it('falls back to small-zero display for zero balance', () => {
    const asset: ERC20Asset = {
      contractAddress: '0xBBB',
      name: 'Zero Token',
      symbol: 'ZTK',
      decimals: 18,
      balance: '0',
    }
    render(<AssetDisplay asset={asset} type="ERC-20" />)
    expect(screen.getByText('0.00000')).toBeInTheDocument()
  })
})

describe('AssetDisplay – NFTDisplay', () => {
  it('shows placeholder when no image provided', () => {
    const asset: NFTAsset = {
      contractAddress: '0xNFT',
      tokenId: '99',
      name: 'Cool NFT',
    }
    render(<AssetDisplay asset={asset} type="ERC-721" />)
    expect(screen.getByText('No Image')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Cool NFT/ })).toBeInTheDocument()
  })

  it('falls back to tokenId label if name is missing', () => {
    const asset: NFTAsset = {
      contractAddress: '0xNFT2',
      tokenId: '1234',
    }
    render(<AssetDisplay asset={asset} type="ERC-721" />)
    expect(screen.getByRole('heading', { name: /Token #1234/ })).toBeInTheDocument()
  })
})
