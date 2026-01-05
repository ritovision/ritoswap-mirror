import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { TokenAccordion } from '../organize/TokenAccordion';
import FetchMock from '@/.storybook/harnesses/FetchMock';
import {
  PORTFOLIO_DEFAULT_ADDRESS,
  PORTFOLIO_SUPPORTED_CHAIN_IDS,
  createPortfolioAlchemyFetchHandlers,
  portfolioTokenToggleArgTypes,
  portfolioTokenToggleDefaults,
} from '@/.storybook/mocks/portfolio';

type StoryArgs = typeof portfolioTokenToggleDefaults & {
  chainId: number;
};

function Harness(args: StoryArgs) {
  const handlers = React.useMemo(() => createPortfolioAlchemyFetchHandlers({ mode: 'ok' }), []);
  const tokenTypes = ([
    args.selectErc20 ? 'ERC-20' : null,
    args.selectErc721 ? 'ERC-721' : null,
    args.selectErc1155 ? 'ERC-1155' : null,
  ].filter(Boolean) as any[]) as ('ERC-20' | 'ERC-721' | 'ERC-1155')[];

  return (
    <FetchMock handlers={handlers}>
      <div style={{ minHeight: '100vh', padding: 24, background: '#012035' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <TokenAccordion chainId={args.chainId} tokenTypes={tokenTypes} address={PORTFOLIO_DEFAULT_ADDRESS} />
          <div style={{ marginTop: 12, opacity: 0.8, fontSize: 13 }}>
            Click a token type to load mocked assets.
          </div>
        </div>
      </div>
    </FetchMock>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Portfolio/Organize/TokenAccordion',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    mockWallet: { connected: true },
  },
  args: {
    ...portfolioTokenToggleDefaults,
    chainId: PORTFOLIO_SUPPORTED_CHAIN_IDS.mainnet,
  },
  argTypes: {
    chainId: { control: { type: 'select' as const }, options: Object.values(PORTFOLIO_SUPPORTED_CHAIN_IDS), table: { category: 'Props' } },
    ...portfolioTokenToggleArgTypes,
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Playground: Story = {};

