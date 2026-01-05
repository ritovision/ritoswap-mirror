import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import WalletModalHost from '../WalletModalHost';
import { openWalletConnectModal } from '../connectModalBridge';

// Mock the ConnectModal component
vi.mock('../ConnectModal', () => ({
  __esModule: true,
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    return isOpen ? (
      <div data-testid="connect-modal">
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null;
  },
}));

// Mock the bridge hook (we'll control it in tests)
const mockUseRegisterWalletConnectOpener = vi.fn();
vi.mock('../connectModalBridge', async () => {
  const actual = await vi.importActual<typeof import('../connectModalBridge')>(
    '../connectModalBridge'
  );
  return {
    ...actual,
    useRegisterWalletConnectOpener: (handler: () => void) => 
      mockUseRegisterWalletConnectOpener(handler),
  };
});

describe('WalletModalHost', () => {
  beforeEach(() => {
    mockUseRegisterWalletConnectOpener.mockClear();
  });

  it('renders nothing initially (modal closed)', () => {
    render(<WalletModalHost />);
    
    expect(screen.queryByTestId('connect-modal')).not.toBeInTheDocument();
  });

  it('registers an opener function on mount', () => {
    render(<WalletModalHost />);
    
    expect(mockUseRegisterWalletConnectOpener).toHaveBeenCalledTimes(1);
    expect(mockUseRegisterWalletConnectOpener).toHaveBeenCalledWith(
      expect.any(Function)
    );
  });

  it('opens modal when registered handler is called', async () => {
    render(<WalletModalHost />);
    
    // Get the registered handler
    const registeredHandler = mockUseRegisterWalletConnectOpener.mock.calls[0][0];
    
    // Call the handler to open modal
    registeredHandler();
    
    await waitFor(() => {
      expect(screen.getByTestId('connect-modal')).toBeInTheDocument();
    });
  });

  it('closes modal when onClose is called', async () => {
    const { container } = render(<WalletModalHost />);
    
    // Get and call the opener
    const registeredHandler = mockUseRegisterWalletConnectOpener.mock.calls[0][0];
    registeredHandler();
    
    await waitFor(() => {
      expect(screen.getByTestId('connect-modal')).toBeInTheDocument();
    });
    
    // Click close button
    const closeBtn = screen.getByRole('button', { name: /close modal/i });
    closeBtn.click();
    
    await waitFor(() => {
      expect(screen.queryByTestId('connect-modal')).not.toBeInTheDocument();
    });
  });

  it('maintains stable handlers (useCallback)', () => {
    const { rerender } = render(<WalletModalHost />);
    
    const firstHandler = mockUseRegisterWalletConnectOpener.mock.calls[0][0];
    
    // Force re-render
    rerender(<WalletModalHost />);
    
    const secondHandler = mockUseRegisterWalletConnectOpener.mock.calls[1][0];
    
    // Handlers should be the same reference (memoized)
    expect(firstHandler).toBe(secondHandler);
  });

  it('can be opened multiple times', async () => {
    render(<WalletModalHost />);
    
    const registeredHandler = mockUseRegisterWalletConnectOpener.mock.calls[0][0];
    
    // Open
    registeredHandler();
    await waitFor(() => {
      expect(screen.getByTestId('connect-modal')).toBeInTheDocument();
    });
    
    // Close
    screen.getByRole('button', { name: /close modal/i }).click();
    await waitFor(() => {
      expect(screen.queryByTestId('connect-modal')).not.toBeInTheDocument();
    });
    
    // Open again
    registeredHandler();
    await waitFor(() => {
      expect(screen.getByTestId('connect-modal')).toBeInTheDocument();
    });
  });

  it('passes isOpen state correctly to ConnectModal', async () => {
    render(<WalletModalHost />);
    
    // Initially closed
    expect(screen.queryByTestId('connect-modal')).not.toBeInTheDocument();
    
    // Open
    const registeredHandler = mockUseRegisterWalletConnectOpener.mock.calls[0][0];
    registeredHandler();
    
    // Now open
    await waitFor(() => {
      expect(screen.getByTestId('connect-modal')).toBeInTheDocument();
    });
  });
});