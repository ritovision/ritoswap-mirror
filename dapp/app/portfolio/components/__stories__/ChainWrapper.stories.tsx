import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import ChainWrapper from '../organize/ChainWrapper';
import type { TokenType } from '../selection/SelectToken';
import FetchMock from '@/.storybook/harnesses/FetchMock';
import {
  PORTFOLIO_DEFAULT_ADDRESS,
  createPortfolioAlchemyFetchHandlers,
  portfolioChainToggleArgTypes,
  portfolioChainToggleDefaults,
  portfolioTokenToggleArgTypes,
  portfolioTokenToggleDefaults,
} from '@/.storybook/mocks/portfolio';
import { useChainInfo } from '@/components/providers/ChainInfoProvider';

type StoryArgs = typeof portfolioChainToggleDefaults &
  typeof portfolioTokenToggleDefaults & {
    walletConnected: boolean;
    selectMainnet: boolean;
    selectSepolia: boolean;
    selectPolygon: boolean;
    selectArbitrum: boolean;
    selectBase: boolean;
    selectOptimism: boolean;
  };

function Harness(args: StoryArgs) {
  const handlers = React.useMemo(() => createPortfolioAlchemyFetchHandlers({ mode: 'ok' }), []);
  const { getChainDisplayName } = useChainInfo();

  const selectedChains = ([
    args.selectMainnet ? 1 : null,
    args.selectSepolia ? 11155111 : null,
    args.selectPolygon ? 137 : null,
    args.selectArbitrum ? 42161 : null,
    args.selectBase ? 8453 : null,
    args.selectOptimism ? 10 : null,
  ].filter(Boolean) as number[]);

  const selectedTokens = ([
    args.selectErc20 ? 'ERC-20' : null,
    args.selectErc721 ? 'ERC-721' : null,
    args.selectErc1155 ? 'ERC-1155' : null,
  ].filter(Boolean) as TokenType[]);

  const chains = selectedChains.map((chainId) => ({
    chainId,
    chainName: getChainDisplayName(chainId),
    tokens: selectedTokens,
  }));

  return (
    <FetchMock handlers={handlers}>
      <div style={{ minHeight: '100vh', padding: 24, background: '#012035' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <ChainWrapper chains={chains} address={args.walletConnected ? PORTFOLIO_DEFAULT_ADDRESS : ''} />
        </div>
      </div>
    </FetchMock>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Portfolio/Organize/ChainWrapper',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    mockWallet: { connected: true },
    mockBalance: { enabled: true, eth: '1.2345' },
  },
  args: {
    ...portfolioChainToggleDefaults,
    ...portfolioTokenToggleDefaults,
    walletConnected: true,
    selectMainnet: true,
    selectSepolia: false,
    selectPolygon: true,
    selectArbitrum: false,
    selectBase: false,
    selectOptimism: false,
  },
  argTypes: {
    walletConnected: { control: { type: 'boolean' as const }, table: { category: 'Wallet' } },
    selectMainnet: { control: { type: 'boolean' as const }, table: { category: 'Selected Chains' } },
    selectSepolia: { control: { type: 'boolean' as const }, table: { category: 'Selected Chains' } },
    selectPolygon: { control: { type: 'boolean' as const }, table: { category: 'Selected Chains' } },
    selectArbitrum: { control: { type: 'boolean' as const }, table: { category: 'Selected Chains' } },
    selectBase: { control: { type: 'boolean' as const }, table: { category: 'Selected Chains' } },
    selectOptimism: { control: { type: 'boolean' as const }, table: { category: 'Selected Chains' } },
    ...portfolioTokenToggleArgTypes,
    ...portfolioChainToggleArgTypes,
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Playground: Story = {};

export const Placeholder: Story = {
  args: {
    walletConnected: false,
    selectMainnet: false,
    selectPolygon: false,
  },
};

