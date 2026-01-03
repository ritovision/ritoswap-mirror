import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import DisconnectButton from '../disconnectButton/DisconnectButton';

type StoryControls = {
  walletConnected?: boolean;
  variant?: 'topnav' | 'bottomnav' | 'no-nav';
};

function Harness({ variant = 'no-nav' }: StoryControls) {
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
      <DisconnectButton variant={variant} />
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Wallet/DisconnectButton',
  component: Harness,
  args: {
    walletConnected: true,
    variant: 'no-nav',
  },
  argTypes: {
    walletConnected: { control: 'boolean', table: { category: 'Wallet' } },
    variant: { control: 'radio', options: ['topnav', 'bottomnav', 'no-nav'], table: { category: 'UI' } },
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Playground: Story = {};

