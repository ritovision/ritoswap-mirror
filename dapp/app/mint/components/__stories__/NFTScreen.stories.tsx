import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { useNFTStore } from '@store/nftStore';
import { createMockKeyToken, DEFAULT_TOKEN_ID, tokenIdArgTypes } from '@/.storybook/mocks/token';

import NFTScreen from '../NFTScreen/NFTScreen';

type NftStoreStoryState = {
  hasNFT: boolean;
  isLoading: boolean;
  isSwitchingAccount: boolean;
  previousData: {
    hasNFT: boolean;
    tokenId: number | null;
    backgroundColor: string | null;
    keyColor: string | null;
  } | null;
  tokenId: number | null;
  backgroundColor: string | null;
  keyColor: string | null;
};


function StoreHarness({ store, children }: { store: NftStoreStoryState; children: React.ReactNode }) {
  const storeKey = JSON.stringify(store);

  React.useLayoutEffect(() => {
    window.localStorage.removeItem('nft-storage');
    useNFTStore.setState({
      hasNFT: store.hasNFT,
      tokenId: store.tokenId,
      backgroundColor: store.backgroundColor,
      keyColor: store.keyColor,
      isLoading: store.isLoading,
      error: null,
      hasUsedTokenGate: false,
      currentAddress: null,
      isSwitchingAccount: store.isSwitchingAccount,
      previousData: store.previousData,
    });
  }, [storeKey, store]);

  return <>{children}</>;
}

function Harness({ store }: { store: NftStoreStoryState; tokenId: number }) {
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
        <StoreHarness store={store}>
          <NFTScreen />
        </StoreHarness>
      </div>
    </div>
  );
}

type StoryArgs = {
  hasNFT: boolean;
  isLoading: boolean;
  isSwitchingAccount: boolean;
  tokenId: number;
};

const meta = {
  title: 'Mint/NFTScreen',
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    hasNFT: false,
    isLoading: false,
    isSwitchingAccount: false,
    tokenId: DEFAULT_TOKEN_ID,
  },
  argTypes: {
    hasNFT: { control: 'boolean', table: { category: 'Store' } },
    isLoading: { control: 'boolean', table: { category: 'Store' } },
    isSwitchingAccount: { control: 'boolean', table: { category: 'Store' } },
    ...tokenIdArgTypes,
  },
} satisfies Meta<StoryArgs>;

export default meta;
type Story = StoryObj<StoryArgs>;

const baseStore: NftStoreStoryState = {
  hasNFT: false,
  tokenId: null,
  backgroundColor: null,
  keyColor: null,
  isLoading: false,
  isSwitchingAccount: false,
  previousData: null,
};

export const Locked: Story = {
  parameters: {
    mockWallet: { connected: false },
  },
  render: (args) => <Harness tokenId={args.tokenId} store={baseStore} />,
};

export const DefaultKey: Story = {
  parameters: {
    mockWallet: { connected: true },
  },
  render: (args) => <Harness tokenId={args.tokenId} store={baseStore} />,
};

export const UserKey: Story = {
  parameters: {
    mockWallet: { connected: true },
  },
  render: (args) => {
    const token = createMockKeyToken(args.tokenId);
    return (
      <Harness
        tokenId={args.tokenId}
        store={{
          ...baseStore,
          hasNFT: true,
          tokenId: token.tokenId,
          backgroundColor: token.backgroundColor,
          keyColor: token.keyColor,
        }}
      />
    );
  },
};

export const SwitchingAccount: Story = {
  parameters: {
    mockWallet: { connected: true },
  },
  render: (args) => {
    const token = createMockKeyToken(args.tokenId);
    return (
      <Harness
        tokenId={args.tokenId}
        store={{
          ...baseStore,
          isSwitchingAccount: true,
          hasNFT: false,
          previousData: {
            hasNFT: true,
            tokenId: token.tokenId,
            backgroundColor: token.backgroundColor,
            keyColor: token.keyColor,
          },
        }}
      />
    );
  },
};

export const Playground: Story = {
  parameters: {
    mockWallet: { connected: true },
  },
  render: (args) => {
    const token = createMockKeyToken(args.tokenId);
    return (
      <Harness
        tokenId={args.tokenId}
        store={{
          ...baseStore,
          hasNFT: args.hasNFT,
          tokenId: args.hasNFT ? token.tokenId : null,
          backgroundColor: args.hasNFT ? token.backgroundColor : null,
          keyColor: args.hasNFT ? token.keyColor : null,
          isLoading: args.isLoading,
          isSwitchingAccount: args.isSwitchingAccount,
          previousData: args.isSwitchingAccount
            ? {
                hasNFT: true,
                tokenId: token.tokenId,
                backgroundColor: token.backgroundColor,
                keyColor: token.keyColor,
              }
            : null,
        }}
      />
    );
  },
};
