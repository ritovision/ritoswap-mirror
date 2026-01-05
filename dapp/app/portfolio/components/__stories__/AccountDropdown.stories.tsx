import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import AccountDropdown from '../selection/AccountDropdown';
import {
  PORTFOLIO_DEFAULT_ADDRESS,
  PORTFOLIO_SECONDARY_ADDRESS,
} from '@/.storybook/mocks/portfolio';

type StoryArgs = {
  walletConnected: boolean;
  selectedAddress: `0x${string}`;
};

function Harness({ walletConnected, selectedAddress }: StoryArgs) {
  const addresses = [PORTFOLIO_DEFAULT_ADDRESS, PORTFOLIO_SECONDARY_ADDRESS] as const;

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
      <div style={{ width: 480, maxWidth: '100%' }}>
        <AccountDropdown
          isConnected={walletConnected}
          selectedAddress={walletConnected ? selectedAddress : ''}
          addresses={walletConnected ? addresses : ([] as any)}
          onConnect={() => {}}
          onAddressChange={() => {}}
        />
      </div>
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Portfolio/Selection/AccountDropdown',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    mockWallet: { connected: true, accounts: [PORTFOLIO_DEFAULT_ADDRESS, PORTFOLIO_SECONDARY_ADDRESS] },
    mockEns: { enabled: true, allAddresses: false, name: 'ritorhymes.eth' },
  },
  args: {
    walletConnected: true,
    selectedAddress: PORTFOLIO_DEFAULT_ADDRESS,
  },
  argTypes: {
    walletConnected: { control: 'boolean', table: { category: 'Wallet' } },
    selectedAddress: { control: 'text', table: { category: 'Wallet' } },
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Connected: Story = {};

export const Disconnected: Story = {
  args: {
    walletConnected: false,
  },
};

