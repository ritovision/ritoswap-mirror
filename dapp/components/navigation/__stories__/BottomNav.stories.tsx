import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import BottomNav from '../bottomNav/BottomNav';
import { MOCK_DEFAULT_ACCOUNTS, MOCK_DEFAULT_ENS_NAME } from '../../../.storybook/mocks/mockWagmiConfig';

type StoryControls = {
  walletConnected?: boolean;
  walletNetwork?: 'mainnet' | 'sepolia' | 'polygon' | 'arbitrum' | 'avalanche' | 'base' | 'optimism' | 'fantom';
  walletAccountsCsv?: string;
  ensEnabled?: boolean;
  ensName?: string;
  balanceEnabled?: boolean;
  balanceEth?: string;
};

function Harness(_props: StoryControls) {
  return (
    <div style={{ minHeight: '100vh', background: '#0b0b0b' }}>
      <main style={{ padding: 24, color: 'white' }}>
        <h2 style={{ marginTop: 0 }}>Page Content</h2>
        <p>View at mobile Breakpoint 730px or less. BottomNav should stay visible and react to wallet state Controls.</p>
      </main>
      <BottomNav />
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Navigation/BottomNav',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    mockWallet: {
      includeWalletConnect: false,
    },
  },
  args: {
    walletConnected: false,
    walletNetwork: 'mainnet',
    walletAccountsCsv: MOCK_DEFAULT_ACCOUNTS[0],
    ensEnabled: true,
    ensName: MOCK_DEFAULT_ENS_NAME,
    balanceEnabled: true,
    balanceEth: '1.2345',
  },
  argTypes: {
    walletConnected: { control: 'boolean', table: { category: 'Wallet' } },
    walletNetwork: {
      control: 'select',
      options: ['mainnet', 'sepolia', 'polygon', 'arbitrum', 'avalanche', 'base', 'optimism', 'fantom'],
      table: { category: 'Wallet' },
    },
    walletAccountsCsv: { control: 'text', table: { category: 'Wallet' } },
    ensEnabled: { control: 'boolean', table: { category: 'ENS' } },
    ensName: { control: 'text', table: { category: 'ENS' } },
    balanceEnabled: { control: 'boolean', table: { category: 'Balance' } },
    balanceEth: { control: 'text', table: { category: 'Balance' } },
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Interactive: Story = {};

export const Static: Story = {
  decorators: [
    (StoryFn) => (
      <div style={{ pointerEvents: 'none' }}>
        <StoryFn />
      </div>
    ),
  ],
};

