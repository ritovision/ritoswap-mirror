import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { useNFTStore } from '@store/nftStore';

import ButtonSection from '../ButtonSection/ButtonSection';

type NftStoreStoryState = {
  hasNFT: boolean;
  hasUsedTokenGate: boolean;
  tokenId: number | null;
  isLoading: boolean;
  isSwitchingAccount: boolean;
};


function PreventNavigation({ children }: { children: React.ReactNode }) {
  return (
    <div
      onClickCapture={(e) => {
        const target = e.target as HTMLElement | null;
        const anchor = target?.closest?.('a');
        if (!anchor) return;
        e.preventDefault();
      }}
    >
      {children}
    </div>
  );
}

function StoreHarness({ store, children }: { store: NftStoreStoryState; children: React.ReactNode }) {
  const storeKey = JSON.stringify(store);

  React.useLayoutEffect(() => {
    window.localStorage.removeItem('nft-storage');
    useNFTStore.setState({
      hasNFT: store.hasNFT,
      hasUsedTokenGate: store.hasUsedTokenGate,
      tokenId: store.tokenId,
      isLoading: store.isLoading,
      isSwitchingAccount: store.isSwitchingAccount,
      error: null,
      backgroundColor: null,
      keyColor: null,
      currentAddress: null,
      previousData: null,
    });
  }, [storeKey, store]);

  return <>{children}</>;
}

function Harness({ store }: { store: NftStoreStoryState }) {
  return (
    <PreventNavigation>
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
        <div style={{ width: 420, maxWidth: '100%' }}>
          <StoreHarness store={store}>
            <ButtonSection />
          </StoreHarness>
        </div>
      </div>
    </PreventNavigation>
  );
}

type StoryArgs = NftStoreStoryState;

const meta = {
  title: 'Mint/ButtonSection',
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    hasNFT: false,
    hasUsedTokenGate: false,
    tokenId: 42,
    isLoading: false,
    isSwitchingAccount: false,
  },
  argTypes: {
    hasNFT: { control: 'boolean', table: { category: 'Store' } },
    hasUsedTokenGate: { control: 'boolean', table: { category: 'Store' } },
    tokenId: { control: 'number', table: { category: 'Store' } },
    isLoading: { control: 'boolean', table: { category: 'Store' } },
    isSwitchingAccount: { control: 'boolean', table: { category: 'Store' } },
  },
} satisfies Meta<StoryArgs>;

export default meta;
type Story = StoryObj<StoryArgs>;

const baseStore: NftStoreStoryState = {
  hasNFT: false,
  hasUsedTokenGate: false,
  tokenId: null,
  isLoading: false,
  isSwitchingAccount: false,
};

export const Loading: Story = {
  parameters: {
    mockWallet: { connected: true },
  },
  render: () => <Harness store={{ ...baseStore, isLoading: true }} />,
};

export const Playground: Story = {
  parameters: {
    mockWallet: { connected: true },
  },
  render: (args) => (
    <Harness
      store={{
        hasNFT: args.hasNFT,
        hasUsedTokenGate: args.hasUsedTokenGate,
        tokenId: args.hasNFT ? args.tokenId : null,
        isLoading: args.isLoading,
        isSwitchingAccount: args.isSwitchingAccount,
      }}
    />
  ),
};

export const NotConnected: Story = {
  parameters: {
    mockWallet: { connected: false },
  },
  render: () => <Harness store={baseStore} />,
};

export const NoNft: Story = {
  parameters: {
    mockWallet: { connected: true },
  },
  render: () => <Harness store={baseStore} />,
};

export const HasNft: Story = {
  parameters: {
    mockWallet: { connected: true },
  },
  render: () => <Harness store={{ ...baseStore, hasNFT: true, tokenId: 42 }} />,
};

export const UsedGate: Story = {
  parameters: {
    mockWallet: { connected: true },
  },
  render: () => <Harness store={{ ...baseStore, hasNFT: true, hasUsedTokenGate: true, tokenId: 42 }} />,
};
