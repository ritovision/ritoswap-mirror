import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { CHAIN_IDS } from '@config/chain';

import ProcessingModal from '../processingModal/ProcessingModal';
import { MOCK_DEFAULT_ACCOUNTS } from '../../../.storybook/mocks/mockWagmiConfig';

type ExplorerNetwork = 'ethereum' | 'sepolia';

type StoryControls = {
  isVisible?: boolean;
  isMobile?: boolean;
  walletConnected?: boolean;
  walletNetwork?: 'mainnet' | 'sepolia';
  walletAccountsCsv?: string;
  explorerNetwork?: ExplorerNetwork;
  showTxLink?: boolean;
  txHash?: string;
};

function Harness({
  isVisible = true,
  isMobile = false,
  explorerNetwork = 'ethereum',
  showTxLink = false,
  txHash = '0x0000000000000000000000000000000000000000000000000000000000000000',
}: StoryControls) {


  const [visible, setVisible] = React.useState(isVisible);

  React.useEffect(() => {
    setVisible(isVisible);
  }, [isVisible]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as Window & { __RITOSWAP_MOBILE_OVERRIDE__?: boolean };
    w.__RITOSWAP_MOBILE_OVERRIDE__ = isMobile;
    return () => {
      delete w.__RITOSWAP_MOBILE_OVERRIDE__;
    };
  }, [isMobile]);

  const chainId =
    explorerNetwork === 'sepolia' ? CHAIN_IDS.sepolia : CHAIN_IDS.ethereum;

  const normalizedTxHash = txHash?.trim();
  const transactionHash =
    showTxLink && normalizedTxHash?.startsWith('0x')
      ? (normalizedTxHash as `0x${string}`)
      : null;

  return (
    <div style={{ minHeight: '100vh' }}>
      <ProcessingModal
        isVisible={visible}
        onCancel={() => setVisible(false)}
        transactionHash={transactionHash}
        targetChainIdOverride={chainId}
      />
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Wallet/ProcessingModal',
  component: Harness,
  parameters: {
    mockWallet: {
      connectorId: 'walletConnect',
    },
  },
  args: {
    isVisible: true,
    isMobile: true,
    walletConnected: true,
    walletNetwork: 'mainnet',
    walletAccountsCsv: MOCK_DEFAULT_ACCOUNTS[0],
    explorerNetwork: 'ethereum',
    showTxLink: false,
    txHash: '0x5e6f0b0f5e6f0b0f5e6f0b0f5e6f0b0f5e6f0b0f5e6f0b0f5e6f0b0f5e6f0b0f',
  },
  argTypes: {
    isVisible: { control: 'boolean', table: { category: 'Modal' } },
    showTxLink: { control: 'boolean', table: { category: 'Modal' } },
    txHash: { control: 'text', table: { category: 'Modal' } },
    explorerNetwork: {
      control: 'radio',
      options: ['ethereum', 'sepolia'],
      table: { category: 'Modal' },
    },
    isMobile: { control: 'boolean', table: { category: 'Device' } },
    walletConnected: { control: 'boolean', table: { category: 'Wallet' } },
    walletNetwork: {
      control: 'radio',
      options: ['mainnet', 'sepolia'],
      table: { category: 'Wallet' },
    },
    walletAccountsCsv: { control: 'text', table: { category: 'Wallet' } },
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Playground: Story = {};

export const WithTxLink: Story = {
  args: {
    showTxLink: true,
  },
};
