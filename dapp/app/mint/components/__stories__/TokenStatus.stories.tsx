import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { useNFTStore } from '@store/nftStore';
import { DEFAULT_TOKEN_ID, tokenIdArgTypes } from '@/.storybook/mocks/token';
import WalletReady from '@/.storybook/harnesses/WalletReady';

import TokenStatus from '../TokenStatus/TokenStatus';

type NftStoreStoryState = {
  hasNFT: boolean;
  hasUsedTokenGate: boolean;
  isLoading: boolean;
};

function StoreHarness({
  store,
  tokenId,
  children,
}: {
  store: NftStoreStoryState;
  tokenId: number;
  children: React.ReactNode;
}) {
  const storeKey = JSON.stringify({ store, tokenId });

  React.useLayoutEffect(() => {
    window.localStorage.removeItem('nft-storage');
    useNFTStore.setState({
      hasNFT: store.hasNFT,
      hasUsedTokenGate: store.hasUsedTokenGate,
      isLoading: store.isLoading,
      tokenId: store.hasNFT ? tokenId : null,
      backgroundColor: null,
      keyColor: null,
      error: null,
      currentAddress: null,
      isSwitchingAccount: false,
      previousData: null,
    });
  }, [storeKey, store, tokenId]);

  return <>{children}</>;
}

function Harness({
  store,
  tokenId,
  requireConnected = false,
}: {
  store: NftStoreStoryState;
  tokenId: number;
  requireConnected?: boolean;
}) {
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
      <div style={{ width: 720, maxWidth: '100%' }}>
        <StoreHarness store={store} tokenId={tokenId}>
          <WalletReady requiredConnected={requireConnected}>
            <TokenStatus />
          </WalletReady>
        </StoreHarness>
      </div>
    </div>
  );
}

type StoryArgs = NftStoreStoryState & { tokenId: number };

const meta = {
  title: 'Mint/TokenStatus',
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    hasNFT: false,
    hasUsedTokenGate: false,
    isLoading: false,
    tokenId: DEFAULT_TOKEN_ID,
  },
  argTypes: {
    hasNFT: { control: 'boolean', table: { category: 'Store' } },
    hasUsedTokenGate: { control: 'boolean', table: { category: 'Store' } },
    isLoading: { control: 'boolean', table: { category: 'Store' } },
    ...tokenIdArgTypes,
  },
} satisfies Meta<StoryArgs>;

export default meta;
type Story = StoryObj<StoryArgs>;

const baseStore: NftStoreStoryState = {
  hasNFT: false,
  hasUsedTokenGate: false,
  isLoading: false,
};

export const Loading: Story = {
  parameters: {
    mockWallet: { connected: true },
  },
  render: (args) => <Harness tokenId={args.tokenId} requireConnected store={{ ...baseStore, isLoading: true }} />,
};

export const NotConnected: Story = {
  parameters: {
    mockWallet: { connected: false },
  },
  render: (args) => <Harness tokenId={args.tokenId} store={baseStore} />,
};

export const NoKey: Story = {
  parameters: {
    mockWallet: { connected: true },
  },
  render: (args) => <Harness tokenId={args.tokenId} requireConnected store={baseStore} />,
};

export const UnusedKey: Story = {
  parameters: {
    mockWallet: { connected: true },
  },
  render: (args) => <Harness tokenId={args.tokenId} requireConnected store={{ ...baseStore, hasNFT: true }} />,
};

export const UsedKey: Story = {
  parameters: {
    mockWallet: { connected: true },
  },
  render: (args) => (
    <Harness tokenId={args.tokenId} requireConnected store={{ ...baseStore, hasNFT: true, hasUsedTokenGate: true }} />
  ),
};

export const Playground: Story = {
  parameters: {
    mockWallet: { connected: true },
  },
  render: (args) => (
    <Harness
      tokenId={args.tokenId}
      requireConnected
      store={{
        hasNFT: args.hasNFT,
        hasUsedTokenGate: args.hasUsedTokenGate,
        isLoading: args.isLoading,
      }}
    />
  ),
};
