import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import NativeBalance from '../assets/NativeBalance';
import {
  PORTFOLIO_DEFAULT_ADDRESS,
  PORTFOLIO_SUPPORTED_CHAIN_IDS,
  portfolioChainToggleArgTypes,
  portfolioChainToggleDefaults,
} from '@/.storybook/mocks/portfolio';

type StoryArgs = typeof portfolioChainToggleDefaults & {
  chainId: number;
};

function Harness({ chainId }: StoryArgs) {
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
      <NativeBalance chainId={chainId} address={PORTFOLIO_DEFAULT_ADDRESS} />
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Portfolio/Assets/NativeBalance',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    mockWallet: { connected: true },
    mockBalance: { enabled: true, eth: '1.2345' },
  },
  args: {
    ...portfolioChainToggleDefaults,
    chainId: PORTFOLIO_SUPPORTED_CHAIN_IDS.mainnet,
  },
  argTypes: {
    chainId: {
      control: { type: 'select' as const },
      options: Object.values(PORTFOLIO_SUPPORTED_CHAIN_IDS),
      table: { category: 'Props' },
    },
    ...portfolioChainToggleArgTypes,
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Default: Story = {};

