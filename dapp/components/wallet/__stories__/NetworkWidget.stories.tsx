import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import NetworkWidget from '../network/NetworkWidget';
import { MOCK_DEFAULT_ACCOUNTS } from '../../../.storybook/mocks/mockWagmiConfig';

type StoryControls = {
  walletConnected?: boolean;
  walletNetwork?: 'mainnet' | 'sepolia' | 'polygon' | 'arbitrum' | 'avalanche' | 'base' | 'optimism' | 'fantom';
  viewNetwork?: 'mainnet' | 'sepolia' | 'polygon' | 'arbitrum' | 'avalanche' | 'base' | 'optimism' | 'fantom';
  walletAccountsCsv?: string;
  balanceEnabled?: boolean;
  balanceEth?: string;
  showMainnet?: boolean;
  showSepolia?: boolean;
  showPolygon?: boolean;
  showArbitrum?: boolean;
  showAvalanche?: boolean;
  showBase?: boolean;
  showOptimism?: boolean;
  showFantom?: boolean;
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
      <NetworkWidget variant="no-nav" />
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Wallet/Network/NetworkWidget',
  component: Harness,
  args: {
    walletConnected: true,
    walletNetwork: 'mainnet',
    viewNetwork: 'mainnet',
    walletAccountsCsv: MOCK_DEFAULT_ACCOUNTS[0],
    balanceEnabled: true,
    balanceEth: '1.2345',
    showMainnet: true,
    showSepolia: true,
    showPolygon: true,
    showArbitrum: true,
    showAvalanche: true,
    showBase: true,
    showOptimism: true,
    showFantom: true,
  },
  argTypes: {
    walletConnected: { control: 'boolean', table: { category: 'Wallet' } },
    walletNetwork: {
      control: 'select',
      options: ['mainnet', 'sepolia', 'polygon', 'arbitrum', 'avalanche', 'base', 'optimism', 'fantom'],
      table: { category: 'Wallet' },
    },
    viewNetwork: {
      control: 'select',
      options: ['mainnet', 'sepolia', 'polygon', 'arbitrum', 'avalanche', 'base', 'optimism', 'fantom'],
      table: { category: 'View Chain' },
    },
    walletAccountsCsv: { control: 'text', table: { category: 'Wallet' } },
    balanceEnabled: { control: 'boolean', table: { category: 'Balance' } },
    balanceEth: { control: 'text', table: { category: 'Balance' } },
    showMainnet: { control: 'boolean', table: { category: 'Visible Networks' } },
    showSepolia: { control: 'boolean', table: { category: 'Visible Networks' } },
    showPolygon: { control: 'boolean', table: { category: 'Visible Networks' } },
    showArbitrum: { control: 'boolean', table: { category: 'Visible Networks' } },
    showAvalanche: { control: 'boolean', table: { category: 'Visible Networks' } },
    showBase: { control: 'boolean', table: { category: 'Visible Networks' } },
    showOptimism: { control: 'boolean', table: { category: 'Visible Networks' } },
    showFantom: { control: 'boolean', table: { category: 'Visible Networks' } },
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Playground: Story = {};
