import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import AddressDisplay from '../addressDisplay/AddressDisplay';
import { MOCK_DEFAULT_ACCOUNTS, MOCK_DEFAULT_ENS_NAME } from '../../../.storybook/mocks/mockWagmiConfig';

type StoryControls = {
  walletConnected?: boolean;
  walletNetwork?: 'mainnet' | 'sepolia';
  walletAccountsCsv?: string;
  ensEnabled?: boolean;
  ensName?: string;
};

function Harness(_props: StoryControls) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <AddressDisplay variant="no-nav" />
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Wallet/AddressDisplay',
  component: Harness,
  args: {
    walletConnected: true,
    walletNetwork: 'mainnet',
    walletAccountsCsv: MOCK_DEFAULT_ACCOUNTS[0],
    ensEnabled: true,
    ensName: MOCK_DEFAULT_ENS_NAME,
  },
  argTypes: {
    walletConnected: { control: 'boolean', table: { category: 'Wallet' } },
    walletNetwork: {
      control: 'radio',
      options: ['mainnet', 'sepolia'],
      table: { category: 'Wallet' },
    },
    walletAccountsCsv: { control: 'text', table: { category: 'Wallet' } },
    ensEnabled: { control: 'boolean', table: { category: 'ENS' } },
    ensName: { control: 'text', table: { category: 'ENS' } },
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Playground: Story = {};
