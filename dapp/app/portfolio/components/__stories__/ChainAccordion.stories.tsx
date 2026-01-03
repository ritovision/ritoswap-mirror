import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import ChainAccordion from '../organize/ChainAccordion';
import FetchMock from '@/.storybook/harnesses/FetchMock';
import {
  PORTFOLIO_DEFAULT_ADDRESS,
  PORTFOLIO_SUPPORTED_CHAIN_IDS,
  createPortfolioAlchemyFetchHandlers,
  portfolioChainToggleArgTypes,
  portfolioChainToggleDefaults,
  portfolioTokenToggleArgTypes,
  portfolioTokenToggleDefaults,
} from '@/.storybook/mocks/portfolio';
import { useChainInfo } from '@/components/providers/ChainInfoProvider';

type StoryArgs = typeof portfolioChainToggleDefaults &
  typeof portfolioTokenToggleDefaults & {
  chainId: number;
};

function Harness(args: StoryArgs) {
  const handlers = React.useMemo(() => createPortfolioAlchemyFetchHandlers({ mode: 'ok' }), []);
  const { getChainDisplayName } = useChainInfo();
  const chainName = getChainDisplayName(args.chainId);
  const tokens = ([
    args.selectErc20 ? 'ERC-20' : null,
    args.selectErc721 ? 'ERC-721' : null,
    args.selectErc1155 ? 'ERC-1155' : null,
  ].filter(Boolean) as any[]) as ('ERC-20' | 'ERC-721' | 'ERC-1155')[];

  return (
    <FetchMock handlers={handlers}>
      <div style={{ minHeight: '100vh', padding: 24, background: '#012035' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <ChainAccordion chainId={args.chainId} chainName={chainName} tokens={tokens} address={PORTFOLIO_DEFAULT_ADDRESS} />
          <div style={{ marginTop: 12, opacity: 0.8, fontSize: 13 }}>
            Expand the network accordion, then expand a token type to load mocked assets.
          </div>
        </div>
      </div>
    </FetchMock>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Portfolio/Organize/ChainAccordion',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    mockWallet: { connected: true },
    mockBalance: { enabled: true, eth: '1.2345' },
  },
  args: {
    ...portfolioChainToggleDefaults,
    ...portfolioTokenToggleDefaults,
    chainId: PORTFOLIO_SUPPORTED_CHAIN_IDS.mainnet,
  },
  argTypes: {
    chainId: { control: { type: 'select' as const }, options: Object.values(PORTFOLIO_SUPPORTED_CHAIN_IDS), table: { category: 'Props' } },
    ...portfolioTokenToggleArgTypes,
    ...portfolioChainToggleArgTypes,
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Playground: Story = {};
