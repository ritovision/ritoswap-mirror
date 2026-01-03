import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import AssetsGrid from '../assets/AssetsGrid';
import type { ERC20Asset, NFTAsset } from '../assets/AssetDisplay';
import { createSvgDataUri } from '@/.storybook/mocks/portfolio';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', padding: 24, background: '#012035' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>{children}</div>
    </div>
  );
}

const erc20Assets: ERC20Asset[] = [
  {
    contractAddress: '0x0000000000000000000000000000000000002000',
    name: 'Mock USD Coin',
    symbol: 'mUSDC',
    decimals: 6,
    balance: '42000000',
    logo: createSvgDataUri('U'),
  },
  {
    contractAddress: '0x0000000000000000000000000000000000001000',
    name: 'Mock Ether Wrap',
    symbol: 'mWETH',
    decimals: 18,
    balance: '1234500000000000000',
    logo: createSvgDataUri('W'),
  },
];

const nftAssets: NFTAsset[] = [
  {
    tokenId: '11',
    contractAddress: '0x000000000000000000000000000000000000a011',
    name: 'Mock Key #11',
    image: createSvgDataUri('K11', { bg: '#000', fg: '#FC1819' }),
  },
  {
    tokenId: '12',
    contractAddress: '0x000000000000000000000000000000000000a011',
    name: 'Mock Key #12',
    image: createSvgDataUri('K12', { bg: '#0b1220', fg: '#93c5fd' }),
  },
];

const meta: Meta<typeof Wrapper> = {
  title: 'Portfolio/Assets/AssetsGrid',
  component: Wrapper,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof Wrapper>;

export const Loading: Story = {
  render: () => (
    <Wrapper>
      <AssetsGrid assets={[]} type="ERC-20" loading />
    </Wrapper>
  ),
};

export const Empty: Story = {
  render: () => (
    <Wrapper>
      <AssetsGrid assets={[]} type="ERC-20" />
    </Wrapper>
  ),
};

export const ERC20: Story = {
  render: () => (
    <Wrapper>
      <AssetsGrid assets={erc20Assets} type="ERC-20" />
    </Wrapper>
  ),
};

export const ERC721: Story = {
  render: () => (
    <Wrapper>
      <AssetsGrid assets={nftAssets} type="ERC-721" />
    </Wrapper>
  ),
};

