import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import NetworkModal from '../network/NetworkModal';
import { MOCK_DEFAULT_ACCOUNTS } from '../../../.storybook/mocks/mockWagmiConfig';

type StoryControls = {
  walletConnected?: boolean;
  walletNetwork?: 'mainnet' | 'sepolia' | 'polygon' | 'arbitrum' | 'avalanche' | 'base' | 'optimism' | 'fantom';
  viewNetwork?: 'mainnet' | 'sepolia' | 'polygon' | 'arbitrum' | 'avalanche' | 'base' | 'optimism' | 'fantom';
  walletAccountsCsv?: string;
  showMainnet?: boolean;
  showSepolia?: boolean;
  showPolygon?: boolean;
  showArbitrum?: boolean;
  showAvalanche?: boolean;
  showBase?: boolean;
  showOptimism?: boolean;
  showFantom?: boolean;
};

function Harness(props: StoryControls) {
  const [isOpen, setIsOpen] = React.useState(true);

  const propsStr = JSON.stringify(props);
  React.useEffect(() => {
    setIsOpen(true);
  }, [propsStr]);

  return <NetworkModal isOpen={isOpen} onClose={() => setIsOpen(false)} />;
}

const meta: Meta<typeof Harness> = {
  title: 'Wallet/Network/NetworkModal',
  component: Harness,
  args: {
    walletConnected: true,
    walletNetwork: 'mainnet',
    viewNetwork: 'mainnet',
    walletAccountsCsv: MOCK_DEFAULT_ACCOUNTS[0],
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
