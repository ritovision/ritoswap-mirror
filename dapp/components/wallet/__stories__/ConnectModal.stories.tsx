import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { MOCK_WALLETCONNECT_URI } from '../../../.storybook/mocks/mockWagmiConfig';
import {
  ConnectModalFlowHarness,
  ConnectModalViewsHarness,
  type ConnectModalViewsHarnessProps,
} from '../../../.storybook/harnesses/connectModalHarness';

const meta: Meta<typeof ConnectModalViewsHarness> = {
  title: 'Wallet/ConnectModal',
  component: ConnectModalViewsHarness,
  args: {
    state: 'default',
    qrUri: MOCK_WALLETCONNECT_URI,
    copied: false,
    connectingWallet: 'metamask',
    canOpenMobile: false,
  },
  argTypes: {
    state: {
      control: 'select',
      options: ['default', 'get-wallet', 'walletconnect-qr', 'connecting', 'error', 'canceled'],
      table: { category: 'State' },
    },
    qrUri: { control: 'text', table: { category: 'WalletConnect' } },
    copied: { control: 'boolean', table: { category: 'WalletConnect' } },
    connectingWallet: {
      control: 'radio',
      options: ['metamask', 'trust', 'walletconnect', 'none'],
      table: { category: 'Wallet' },
    },
    canOpenMobile: { control: 'boolean', table: { category: 'Connecting' } },
  },
};

export default meta;
type Story = StoryObj<typeof ConnectModalViewsHarness>;

export const Default: Story = {
  args: { state: 'default' },
};

export const GetWallet: Story = {
  args: { state: 'get-wallet' },
};

export const WalletConnectQr: Story = {
  args: { state: 'walletconnect-qr', qrUri: MOCK_WALLETCONNECT_URI, copied: false },
};

export const WalletConnectQrGenerating: Story = {
  args: { state: 'walletconnect-qr', qrUri: '' },
};

export const WalletConnectQrCopied: Story = {
  args: { state: 'walletconnect-qr', qrUri: MOCK_WALLETCONNECT_URI, copied: true },
};

export const ConnectingInjected: Story = {
  args: { state: 'connecting', connectingWallet: 'metamask', canOpenMobile: false },
};

export const ConnectingWalletConnectDesktop: Story = {
  args: { state: 'connecting', connectingWallet: 'walletconnect', qrUri: MOCK_WALLETCONNECT_URI, canOpenMobile: false },
};

export const ConnectingWalletConnectMobile: Story = {
  args: { state: 'connecting', connectingWallet: 'walletconnect', qrUri: MOCK_WALLETCONNECT_URI, canOpenMobile: true },
};

export const Error: Story = {
  args: { state: 'error', connectingWallet: 'metamask' },
};

export const Canceled: Story = {
  args: { state: 'canceled', connectingWallet: 'metamask' },
};

export const InteractiveFlow: Story = {
  render: () => <ConnectModalFlowHarness />,
  parameters: {
    controls: { disable: true },
  },
};

export const Playground: Story = {
  render: (args: ConnectModalViewsHarnessProps) => <ConnectModalViewsHarness {...args} />,
};
