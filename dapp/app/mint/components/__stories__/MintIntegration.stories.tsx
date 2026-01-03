import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { useNFTStore } from '@store/nftStore';
import { KEY_BG, KEY_FG, DEFAULT_TOKEN_ID, tokenIdArgTypes } from '@/.storybook/mocks/token';
import WalletReady from '@/.storybook/harnesses/WalletReady';

import TokenStatus from '../TokenStatus/TokenStatus';
import NFTScreen from '../NFTScreen/NFTScreen';
import ButtonSection from '../ButtonSection/ButtonSection';
import Instructions from '../Instructions/Instructions';
import Music from '../Music';

type MintStoryArgs = {
  walletConnected: boolean;
  hasNFT: boolean;
  hasUsedTokenGate: boolean;
  isLoading: boolean;
  isSwitchingAccount: boolean;
  tokenId: number;
  backgroundColor: string;
  keyColor: string;
  showInstructions: boolean;
  showMusic: boolean;
};

function StoreHarness({ args, children }: { args: MintStoryArgs; children: React.ReactNode }) {
  const storeKey = JSON.stringify(args);

  React.useLayoutEffect(() => {
    window.localStorage.removeItem('nft-storage');

    useNFTStore.setState({
      hasNFT: args.hasNFT,
      tokenId: args.hasNFT ? args.tokenId : null,
      backgroundColor: args.hasNFT ? args.backgroundColor : null,
      keyColor: args.hasNFT ? args.keyColor : null,
      isLoading: args.isLoading,
      error: null,
      hasUsedTokenGate: args.hasUsedTokenGate,
      currentAddress: null,
      isSwitchingAccount: false,
      previousData: null,
    });

    if (!args.isSwitchingAccount) return;
    const timeoutId = window.setTimeout(() => {
      useNFTStore.setState({
        isSwitchingAccount: true,
        previousData: {
          hasNFT: args.hasNFT,
          tokenId: args.hasNFT ? args.tokenId : null,
          backgroundColor: args.hasNFT ? args.backgroundColor : null,
          keyColor: args.hasNFT ? args.keyColor : null,
        },
      });
    }, 200);

    return () => window.clearTimeout(timeoutId);
  }, [storeKey, args]);

  return <>{children}</>;
}

function Harness(args: MintStoryArgs) {
  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 24,
        background: '#012035',
        color: 'white',
      }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <StoreHarness args={args}>
          <WalletReady requiredConnected={args.walletConnected}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <TokenStatus />
              <NFTScreen />
              <ButtonSection onRefresh={() => {}} />
            </div>
          </WalletReady>
          {args.showInstructions ? (
            <div style={{ marginTop: 24 }}>
              <Instructions />
            </div>
          ) : null}
          {args.showMusic ? (
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
              <Music />
            </div>
          ) : null}
        </StoreHarness>
      </div>
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Mint/Integration',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    walletConnected: true,
    hasNFT: false,
    hasUsedTokenGate: false,
    isLoading: false,
    isSwitchingAccount: false,
    tokenId: DEFAULT_TOKEN_ID,
    backgroundColor: KEY_BG,
    keyColor: KEY_FG,
    showInstructions: true,
    showMusic: false,
  },
  argTypes: {
    walletConnected: { control: 'boolean', table: { category: 'Wallet' } },
    ...tokenIdArgTypes,
    hasNFT: { control: 'boolean', table: { category: 'Store' } },
    hasUsedTokenGate: { control: 'boolean', table: { category: 'Store' } },
    isLoading: { control: 'boolean', table: { category: 'Store' } },
    isSwitchingAccount: { control: 'boolean', table: { category: 'Store' } },
    backgroundColor: { control: 'color', table: { category: 'Token' } },
    keyColor: { control: 'color', table: { category: 'Token' } },
    showInstructions: { control: 'boolean', table: { category: 'Layout' } },
    showMusic: { control: 'boolean', table: { category: 'Layout' } },
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Playground: Story = {};

export const NotConnected: Story = {
  args: {
    walletConnected: false,
  },
};

export const NoKey: Story = {
  args: {
    walletConnected: true,
    hasNFT: false,
    hasUsedTokenGate: false,
  },
};

export const UnusedKey: Story = {
  args: {
    walletConnected: true,
    hasNFT: true,
    hasUsedTokenGate: false,
  },
};

export const UsedKey: Story = {
  args: {
    walletConnected: true,
    hasNFT: true,
    hasUsedTokenGate: true,
  },
};

export const SwitchingAccount: Story = {
  args: {
    walletConnected: true,
    hasNFT: true,
    hasUsedTokenGate: false,
    isSwitchingAccount: true,
  },
};

