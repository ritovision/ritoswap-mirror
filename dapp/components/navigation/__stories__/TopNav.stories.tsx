import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import TopNav from '../topNav/TopNav';
import Hamburger from '../mobileNav/Hamburger';
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

function PreventNavigation({ children }: { children: React.ReactNode }) {
  return (
    <div
      onClickCapture={(e) => {
        const target = e.target as HTMLElement | null;
        const anchor = target?.closest?.('a');
        if (!anchor) return;
        e.preventDefault();
      }}
    >
      {children}
    </div>
  );
}

function Harness(_props: StoryControls) {
  return (
    <PreventNavigation>
      <div style={{ minHeight: '100vh', background: '#0b0b0b' }}>
        <TopNav />
        <Hamburger />
        <main style={{ padding: 24, color: 'white' }}>
          <h2 style={{ marginTop: 0 }}>Page Content</h2>
          <p>At 731px or more you should see the menu links and a connect button; less than that just the hamburger icon. Use Controls to toggle connected/disconnected and mock wallet values.</p>
        </main>
      </div>
    </PreventNavigation>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Navigation/TopNav',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    mockWallet: {
      // Avoid accidental wc: navigation on small storybook canvases.
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
