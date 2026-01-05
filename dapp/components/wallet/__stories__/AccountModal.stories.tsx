import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import AccountModal from '../accountModal/AccountModal';
import { MOCK_DEFAULT_ACCOUNTS, MOCK_DEFAULT_ENS_NAME } from '../../../.storybook/mocks/mockWagmiConfig';

type StoryControls = {
  initiallyOpen?: boolean;
  walletConnected?: boolean;
  walletNetwork?: 'mainnet' | 'sepolia';
  viewNetwork?: 'mainnet' | 'sepolia';
  walletAccountsCsv?: string;
  ensEnabled?: boolean;
  ensName?: string;
  balanceEnabled?: boolean;
  balanceEth?: string;
};

function Harness({ initiallyOpen = true }: StoryControls) {
  const [isOpen, setIsOpen] = React.useState(initiallyOpen);
  return (
    <div style={{ padding: 16 }}>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open modal
      </button>
      <AccountModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Wallet/AccountModal',
  component: Harness,
  args: {
    initiallyOpen: true,
    walletConnected: true,
    walletNetwork: 'mainnet',
    viewNetwork: 'mainnet',
    walletAccountsCsv: MOCK_DEFAULT_ACCOUNTS[0],
    ensEnabled: true,
    ensName: MOCK_DEFAULT_ENS_NAME,
    balanceEnabled: true,
    balanceEth: '1.2345',
  },
  argTypes: {
    initiallyOpen: { control: 'boolean', table: { category: 'Modal' } },
    walletConnected: { control: 'boolean', table: { category: 'Wallet' } },
    walletNetwork: {
      control: 'radio',
      options: ['mainnet', 'sepolia'],
      table: { category: 'Wallet' },
    },
    viewNetwork: {
      control: 'radio',
      options: ['mainnet', 'sepolia'],
      table: { category: 'View Chain' },
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

export const Playground: Story = {};

export const MultipleAccounts: Story = {
  parameters: {
    // Keep secondary accounts fixed for this story (Controls can still change the primary address).
    walletSecondaryAccounts: [
      '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    ],
    mockBalance: {
      enabled: true,
      ethByAddress: {
        '0x70997970c51812dc3a010c7d01b50e0d17dc79c8': '0.42',
        '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc': '12.345',
      },
    },
  },
  args: {
    walletAccountsCsv: MOCK_DEFAULT_ACCOUNTS[0],
  },
};
