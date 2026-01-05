import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import WalletModalHost from '../WalletModalHost';
import { openWalletConnectModal } from '../connectModalBridge';

/**
 * Integration test for the complete wallet connection flow:
 * WalletModalHost + connectModalBridge + ConnectModal working together.
 * 
 * This tests the PUBLIC API that external code (like LiFi widget) uses.
 */

// Mock CSS modules
vi.mock('../styles/ModalWrapper.module.css', () => ({ default: {} }));
vi.mock('../styles/WalletList.module.css', () => ({ default: {} }));
vi.mock('../styles/Logo.module.css', () => ({ default: {} }));
vi.mock('../styles/ConnectingStates.module.css', () => ({ default: {} }));
vi.mock('../styles/GetWalletView.module.css', () => ({ default: {} }));
vi.mock('../styles/QrView.module.css', () => ({ default: {} }));

// Mock hooks we don't need for this integration
vi.mock('../hooks/useFocusTrap', () => ({ useFocusTrap: () => {} }));
vi.mock('../hooks/useSwipeToClose', () => ({ useSwipeToClose: () => ({}) }));
vi.mock('../hooks/useAutoCloseOnRoute', () => ({ useAutoCloseOnRoute: () => {} }));

// Mock the views to simplify testing
vi.mock('../views/DefaultView', () => ({
  DefaultView: ({ connectors, onSelect, onGetWallet, onClose }: any) => (
    <div role="region" aria-labelledby="modal-title">
      <h2 id="modal-title">Connect Your Wallet</h2>
      <button onClick={onClose} aria-label="Close wallet connection modal">
        Close
      </button>
      <div role="list" aria-label="Available wallets">
        {connectors?.map((c: any) => (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            aria-label={`Connect with ${c.name}`}
          >
            {c.name}
          </button>
        ))}
      </div>
      <button onClick={onGetWallet}>I don't have a wallet yet</button>
    </div>
  )
}));

vi.mock('../views/ConnectingView', () => ({
  ConnectingView: ({ wallet, onCancel }: any) => (
    <div role="alert">
      <div>Connecting to {wallet?.name}...</div>
      <button onClick={onCancel}>Cancel</button>
    </div>
  )
}));

vi.mock('../views/ErrorView', () => ({
  ErrorView: ({ wallet }: any) => (
    <div role="alert">
      <div>Error connecting to {wallet?.name}</div>
    </div>
  )
}));

vi.mock('../views/CanceledView', () => ({
  CanceledView: ({ wallet }: any) => (
    <div>Connection canceled for {wallet?.name}</div>
  )
}));

vi.mock('../views/GetWalletView', () => ({
  GetWalletView: ({ onBack }: any) => (
    <div>
      <h2>Get a Wallet</h2>
      <button onClick={onBack}>Back</button>
    </div>
  )
}));

vi.mock('../views/QrView', () => ({
  QrView: ({ qrUri, onBack }: any) => (
    <div>
      <h2>Scan QR Code</h2>
      <div data-testid="qr" data-value={qrUri} />
      <button onClick={onBack}>Back</button>
    </div>
  )
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn() }),
  usePathname: () => '/',
}));

// Mock react-dom portal
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (node: any) => node,
  };
});

// Mock wagmi with controllable state
let __connectors: any[] = [];
let __isConnected = false;
let __chainId = 1;
let __connectMode: 'resolve' | 'reject' | 'pending' = 'resolve';

function __setConnectors(connectors: any[]) {
  __connectors = connectors;
}

function __setAccountConnected(connected: boolean) {
  __isConnected = connected;
}

function __setChainId(chainId: number) {
  __chainId = chainId
}

function __setConnectResolve() {
  __connectMode = 'resolve';
}

function __setConnectReject() {
  __connectMode = 'reject';
}

const mockConnectAsync = vi.fn(async () => {
  if (__connectMode === 'resolve') return {};
  if (__connectMode === 'reject') throw new Error('Connection failed');
  return new Promise(() => {}); // pending
});

const mockReset = vi.fn();
const mockSwitchChainAsync = vi.fn(async () => {});

vi.mock('wagmi', () => ({
  useAccount: () => ({ isConnected: __isConnected }),
  useChainId: () => __chainId,
  useConnect: () => ({
    connectors: __connectors,
    connectAsync: mockConnectAsync,
    reset: mockReset,
  }),
  useSwitchChain: () => ({ switchChainAsync: mockSwitchChainAsync }),
}));

describe('Wallet Connection Integration', () => {
  beforeEach(() => {
    // Ensure document.body exists
    if (!document.body) {
      document.body = document.createElement('body');
    }

    // Reset wagmi state
    __setAccountConnected(false);
    __setChainId(1);
    __setConnectResolve();
    mockConnectAsync.mockClear();
    mockReset.mockClear();
    mockSwitchChainAsync.mockClear();

    // Default connectors
    __setConnectors([
      {
        id: 'metamask',
        name: 'MetaMask',
        type: 'injected',
        icon: '/images/metamask.png',
      },
      {
        id: 'walletconnect',
        name: 'WalletConnect',
        type: 'walletConnect',
        icon: '/images/wallets/walletconnect.png',
      },
    ]);

    // Mock clipboard
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  describe('Basic Flow - External Code Opens Modal', () => {
    it('renders WalletModalHost and opens modal via openWalletConnectModal()', async () => {
      render(<WalletModalHost />);

      // Modal should be closed initially
      expect(screen.queryByRole('heading', { name: /connect your wallet/i })).not.toBeInTheDocument();

      // External code (like LiFi widget) calls the bridge function
      act(() => {
        openWalletConnectModal();
      });

      // Modal should now be open
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /connect your wallet/i })).toBeInTheDocument();
      });
    });

    it('closes modal via backdrop click', async () => {
      render(<WalletModalHost />);

      // Open modal
      act(() => {
        openWalletConnectModal();
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /connect your wallet/i })).toBeInTheDocument();
      });

      // Close via backdrop
      fireEvent.click(screen.getByLabelText(/close modal/i));

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: /connect your wallet/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Multiple Opens', () => {
    it('handles multiple open/close cycles', async () => {
      render(<WalletModalHost />);

      // First open
      act(() => {
        openWalletConnectModal();
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /connect your wallet/i })).toBeInTheDocument();
      });

      // Close
      fireEvent.click(screen.getByLabelText(/close modal/i));

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: /connect your wallet/i })).not.toBeInTheDocument();
      });

      // Wait a bit to ensure bridge debounce clears
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Second open
      act(() => {
        openWalletConnectModal();
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /connect your wallet/i })).toBeInTheDocument();
      });
    });

    it('debounces rapid successive calls', async () => {
      render(<WalletModalHost />);

      // Call multiple times rapidly (like a buggy widget might)
      act(() => {
        openWalletConnectModal();
        openWalletConnectModal();
        openWalletConnectModal();
      });

      // Should only open once
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /connect your wallet/i })).toBeInTheDocument();
      });

      // No errors or double-renders
      expect(screen.getAllByRole('heading', { name: /connect your wallet/i })).toHaveLength(1);
    });
  });

  describe('Simulated Widget Integration', () => {
    /**
     * Simulates how the LiFi widget (or similar) would use the API
     */
    function MockWidget() {
      return (
        <div>
          <button
            onClick={() => openWalletConnectModal()}
            aria-label="Widget Connect Button"
          >
            Connect Wallet (from widget)
          </button>
        </div>
      );
    }

    it('widget can open modal via bridge', async () => {
      render(
        <>
          <WalletModalHost />
          <MockWidget />
        </>
      );

      // Widget's connect button should be visible
      const widgetBtn = screen.getByRole('button', { name: /widget connect button/i });
      expect(widgetBtn).toBeInTheDocument();

      // Modal should be closed
      expect(screen.queryByRole('heading', { name: /connect your wallet/i })).not.toBeInTheDocument();

      // Click widget's button
      fireEvent.click(widgetBtn);

      // Modal should open
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /connect your wallet/i })).toBeInTheDocument();
      });
    });

    it('complete flow: widget opens modal, user selects wallet', async () => {
      render(
        <>
          <WalletModalHost />
          <MockWidget />
        </>
      );

      // Click widget button
      fireEvent.click(screen.getByRole('button', { name: /widget connect button/i }));

      // Modal opens
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /connect your wallet/i })).toBeInTheDocument();
      });

      // User clicks MetaMask
      fireEvent.click(screen.getByLabelText(/connect with metamask/i));

      // Should call connectAsync
      await waitFor(() => {
        expect(mockConnectAsync).toHaveBeenCalledWith(
          expect.objectContaining({ connector: expect.objectContaining({ id: 'metamask' }) })
        );
      });
    });
  });

  describe('Real-World Scenarios', () => {
    it('handles connection while modal is open', async () => {
      const { rerender } = render(<WalletModalHost />);

      // Open modal
      act(() => {
        openWalletConnectModal();
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /connect your wallet/i })).toBeInTheDocument();
      });

      // User connects externally (e.g., injected wallet auto-connects)
      act(() => {
        __setAccountConnected(true);
      });

      // Force rerender to trigger effect
      rerender(<WalletModalHost />);

      // Modal should remain open (doesn't auto-close unless in connecting state)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /connect your wallet/i })).toBeInTheDocument();
      });
    });

    it('prevents opening while already open', async () => {
      render(<WalletModalHost />);

      // First open
      act(() => {
        openWalletConnectModal();
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /connect your wallet/i })).toBeInTheDocument();
      });

      // Try to open again while already open
      act(() => {
        openWalletConnectModal();
      });

      // Should still only have one modal
      expect(screen.getAllByRole('heading', { name: /connect your wallet/i })).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('handles opening when no connectors are available', async () => {
      __setConnectors([]);

      render(<WalletModalHost />);

      act(() => {
        openWalletConnectModal();
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /connect your wallet/i })).toBeInTheDocument();
      });

      // Should show the modal even with no connectors (lets user see "I don't have a wallet yet" option)
      expect(screen.getByText(/i don't have a wallet yet/i)).toBeInTheDocument();
    });

    it('recovers from connection errors', async () => {
      render(<WalletModalHost />);

      // Open modal
      act(() => {
        openWalletConnectModal();
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /connect your wallet/i })).toBeInTheDocument();
      });

      // Simulate connection error (generic error, not user rejection)
      __setConnectReject();

      // Click MetaMask
      fireEvent.click(screen.getByLabelText(/connect with metamask/i));

      // Should show error view (the actual error handling in the component 
      // treats any non-"User rejected" error as a generic error)
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // After timeout, should return to default view
      await waitFor(
        () => {
          expect(screen.getByRole('heading', { name: /connect your wallet/i })).toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      // Fix connection mode and try again
      __setConnectResolve();

      // Should be able to try connecting again
      fireEvent.click(screen.getByLabelText(/connect with metamask/i));

      await waitFor(() => {
        expect(mockConnectAsync).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Component Unmounting', () => {
    it('calling openWalletConnectModal after unmount does nothing', async () => {
      const { unmount } = render(<WalletModalHost />);

      // Verify it works initially
      act(() => {
        openWalletConnectModal();
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /connect your wallet/i })).toBeInTheDocument();
      });

      // Unmount the host
      unmount();

      // Try to open again - should not throw or cause errors
      expect(() => {
        act(() => {
          openWalletConnectModal();
        });
      }).not.toThrow();

      // Nothing should be rendered
      expect(screen.queryByRole('heading', { name: /connect your wallet/i })).not.toBeInTheDocument();
    });
  });
});
