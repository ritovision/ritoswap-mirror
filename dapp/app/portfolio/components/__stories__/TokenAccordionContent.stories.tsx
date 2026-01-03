import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import TokenAccordionContent from '../assets/TokenAccordionContent';
import type { TokenType } from '../selection/SelectToken';
import FetchMock from '@/.storybook/harnesses/FetchMock';
import {
  PORTFOLIO_DEFAULT_ADDRESS,
  PORTFOLIO_SUPPORTED_CHAIN_IDS,
  createPortfolioAlchemyFetchHandlers,
  portfolioChainToggleArgTypes,
  portfolioChainToggleDefaults,
} from '@/.storybook/mocks/portfolio';

type StoryArgs = typeof portfolioChainToggleDefaults & {
  chainId: number;
  tokenType: TokenType;
  mode: 'ok' | 'error';
};

function Harness({ chainId, tokenType, mode }: StoryArgs) {
  const handlers = React.useMemo(() => createPortfolioAlchemyFetchHandlers({ mode }), [mode]);

  return (
    <FetchMock handlers={handlers}>
      <div style={{ minHeight: '100vh', padding: 24, background: '#012035' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <TokenAccordionContent chainId={chainId} tokenType={tokenType} address={PORTFOLIO_DEFAULT_ADDRESS} />
        </div>
      </div>
    </FetchMock>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Portfolio/Assets/TokenAccordionContent',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    mockWallet: { connected: true },
  },
  args: {
    ...portfolioChainToggleDefaults,
    chainId: PORTFOLIO_SUPPORTED_CHAIN_IDS.mainnet,
    tokenType: 'ERC-721',
    mode: 'ok',
  },
  argTypes: {
    chainId: {
      control: { type: 'select' as const },
      options: Object.values(PORTFOLIO_SUPPORTED_CHAIN_IDS),
      table: { category: 'Props' },
    },
    tokenType: { control: { type: 'select' as const }, options: ['ERC-20', 'ERC-721', 'ERC-1155'], table: { category: 'Props' } },
    mode: { control: { type: 'inline-radio' as const }, options: ['ok', 'error'], table: { category: 'Mock' } },
    ...portfolioChainToggleArgTypes,
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Playground: Story = {};

export const Error: Story = {
  args: {
    mode: 'error',
    tokenType: 'ERC-721',
  },
};
