import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import AssetDisplay, { type ERC20Asset, type NFTAsset } from '../assets/AssetDisplay';
import { createSvgDataUri } from '@/.storybook/mocks/portfolio';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 24,
        background: '#012035',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: 460, maxWidth: '100%' }}>{children}</div>
    </div>
  );
}

const sampleErc20: ERC20Asset = {
  contractAddress: '0x0000000000000000000000000000000000002000',
  name: 'Mock USD Coin',
  symbol: 'mUSDC',
  decimals: 6,
  balance: '42000000',
  logo: createSvgDataUri('U'),
  price: 1.0,
};

const sampleErc20NoLogo: ERC20Asset = {
  ...sampleErc20,
  contractAddress: '0x0000000000000000000000000000000000002001',
  symbol: 'NL',
  logo: undefined,
  price: undefined,
};

const sampleErc721: NFTAsset = {
  tokenId: '11',
  contractAddress: '0x000000000000000000000000000000000000a011',
  name: 'Mock Key #11',
  description: 'A mocked ERC-721 key asset for Storybook.',
  image: createSvgDataUri('K11', { bg: '#000000', fg: '#FC1819' }),
  attributes: [
    { trait_type: 'Rarity', value: 'Common' },
    { trait_type: 'Color', value: '#FC1819' },
    { trait_type: 'Series', value: 1 },
    { trait_type: 'Origin', value: 'Storybook' },
    { trait_type: 'Extra', value: 'Hidden' },
  ],
};

const sampleNoImage: NFTAsset = {
  tokenId: '0',
  contractAddress: '0x000000000000000000000000000000000000a012',
  name: 'No Image NFT',
};

const meta = {
  title: 'Portfolio/Assets/AssetDisplay',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type NftStoryArgs = {
  name: string;
  tokenId: string;
  hasImage: boolean;
  hasAttributes: boolean;
  balance: string;
};

type NftPlaygroundStory = StoryObj<NftStoryArgs>;

function createNftAsset(args: NftStoryArgs, type: 'ERC-721' | 'ERC-1155'): NFTAsset {
  return {
    tokenId: args.tokenId,
    contractAddress: '0x000000000000000000000000000000000000a0b5',
    name: args.name,
    image: args.hasImage ? createSvgDataUri(args.name.slice(0, 3), { bg: '#0b1220', fg: '#7dd3fc' }) : undefined,
    attributes: args.hasAttributes
      ? [
          { trait_type: 'Series', value: 1 },
          { trait_type: 'Rarity', value: 'Common' },
          { trait_type: 'Origin', value: 'Storybook' },
        ]
      : undefined,
    balance: type === 'ERC-1155' ? args.balance : undefined,
  };
}

export const ERC20: Story = {
  render: () => (
    <Wrapper>
      <AssetDisplay asset={sampleErc20} type="ERC-20" />
    </Wrapper>
  ),
};

export const ERC20_NoLogo: Story = {
  render: () => (
    <Wrapper>
      <AssetDisplay asset={sampleErc20NoLogo} type="ERC-20" />
    </Wrapper>
  ),
};

export const ERC721: Story = {
  render: () => (
    <Wrapper>
      <AssetDisplay asset={sampleErc721} type="ERC-721" />
    </Wrapper>
  ),
};

export const ERC721_NoImage: Story = {
  render: () => (
    <Wrapper>
      <AssetDisplay asset={sampleNoImage} type="ERC-721" />
    </Wrapper>
  ),
};

export const ERC721_Playground: NftPlaygroundStory = {
  args: {
    name: 'Mock Key #721',
    tokenId: '721',
    hasImage: true,
    hasAttributes: true,
    balance: '1',
  },
  render: (args) => (
    <Wrapper>
      <AssetDisplay asset={createNftAsset(args as NftStoryArgs, 'ERC-721')} type="ERC-721" />
    </Wrapper>
  ),
};

export const ERC1155_Playground: NftPlaygroundStory = {
  args: {
    name: 'Mock Key #1155',
    tokenId: '1155',
    hasImage: true,
    hasAttributes: true,
    balance: '3',
  },
  render: (args) => (
    <Wrapper>
      <AssetDisplay asset={createNftAsset(args as NftStoryArgs, 'ERC-1155')} type="ERC-1155" />
    </Wrapper>
  ),
};
