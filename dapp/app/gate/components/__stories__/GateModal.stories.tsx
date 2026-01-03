import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { useNFTStore } from '@store/nftStore';
import { DEFAULT_TOKEN_ID, tokenIdArgTypes } from '@/.storybook/mocks/token';
import WalletReady from '@/.storybook/harnesses/WalletReady';

import GateModal from '../GateModal/GateModal';

type GateModalStoryArgs = {
  tokenId: number;
  isAnimating: boolean;
};

type NftStoreStoryState = {
  hasNFT: boolean;
  hasUsedTokenGate: boolean;
  isLoading: boolean;
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

function StoreHarness({
  tokenId,
  store,
  children,
}: {
  tokenId: number;
  store: NftStoreStoryState;
  children: React.ReactNode;
}) {
  const storeKey = JSON.stringify({ tokenId, store });
  const [ready, setReady] = React.useState(false);

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
    setReady(true);
  }, [storeKey, tokenId, store]);

  if (!ready) return null;
  return <>{children}</>;
}

function StabilizeFirstPaint({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), 120);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}>
      {children}
    </div>
  );
}

function Scene({
  tokenId,
  isAnimating,
  store,
  requireConnected,
}: GateModalStoryArgs & {
  store: NftStoreStoryState;
  requireConnected: boolean;
}) {
  return (
    <PreventNavigation>
      <div
        style={{
          minHeight: '100vh',
          background: '#012035',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <StoreHarness tokenId={tokenId} store={store}>
            <WalletReady requiredConnected={requireConnected}>
              <StabilizeFirstPaint>
                <div style={{ minWidth: 350 }}>
                  <GateModal onUnlock={() => {}} isAnimating={isAnimating} />
                </div>
              </StabilizeFirstPaint>
            </WalletReady>
          </StoreHarness>
        </div>
      </div>
    </PreventNavigation>
  );
}

const meta = {
  title: 'Gate/GateModal',
  component: Scene,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    tokenId: DEFAULT_TOKEN_ID,
    isAnimating: false,
    store: {
      hasNFT: false,
      hasUsedTokenGate: false,
      isLoading: false,
    },
    requireConnected: true,
  },
  argTypes: {
    ...tokenIdArgTypes,
    isAnimating: { control: 'boolean' },
    store: { table: { disable: true } },
    requireConnected: { table: { disable: true } },
  },
} satisfies Meta<typeof Scene>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  parameters: { mockWallet: { connected: true } },
  args: {
    store: {
      hasNFT: false,
      hasUsedTokenGate: false,
      isLoading: true,
    },
  },
};

export const NotConnected: Story = {
  parameters: { mockWallet: { connected: false } },
  args: {
    requireConnected: false,
  },
};

export const NoKey: Story = {
  parameters: { mockWallet: { connected: true } },
};

export const HasUnusedKey: Story = {
  parameters: { mockWallet: { connected: true } },
  args: {
    store: {
      hasNFT: true,
      hasUsedTokenGate: false,
      isLoading: false,
    },
  },
};

export const HasUsedKey: Story = {
  parameters: { mockWallet: { connected: true } },
  args: {
    store: {
      hasNFT: true,
      hasUsedTokenGate: true,
      isLoading: false,
    },
  },
};
