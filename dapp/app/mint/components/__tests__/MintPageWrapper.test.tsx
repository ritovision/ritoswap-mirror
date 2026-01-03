// app/mint/components/__tests__/MintPageWrapper.test.tsx
import { renderWithWagmi } from '@/test/utils/wagmi';
import MintPageWrapper from '../MintPageWrapper';
import { useAccount, useWatchContractEvent } from 'wagmi';
import { useNFTStore } from '@/app/store/nftStore';
import { useNFTData } from '@/app/hooks/useNFTData';

// wagmi hooks mocked so we can capture onLogs
vi.mock('wagmi', async () => {
  const actual = await import('wagmi');
  return {
    ...actual,
    useAccount: vi.fn(),
    useWatchContractEvent: vi.fn(),
  };
});

vi.mock('@/app/store/nftStore');
vi.mock('@/app/hooks/useNFTData');

// ✅ hoist-safe notifications mock
vi.mock('@/app/lib/notifications', () => {
  const sendNotificationEvent = vi.fn();
  return { sendNotificationEvent };
});

// Mock child components
vi.mock('../TokenStatus/TokenStatus', () => ({
  default: () => <div>TokenStatus</div>,
}));
vi.mock('../NFTScreen/NFTScreen', () => ({
  default: () => <div>NFTScreen</div>,
}));
vi.mock('../ButtonSection/ButtonSection', () => ({
  default: () => <div>ButtonSection</div>,
}));

// import mocked fn AFTER mocks
import { sendNotificationEvent } from '@/app/lib/notifications';

describe('MintPageWrapper', () => {
  const mockSetCurrentAddress = vi.fn();
  const mockResetState = vi.fn();
  const mockStartAccountSwitch = vi.fn();
  const mockCompleteAccountSwitch = vi.fn();
  const mockForceRefresh = vi.fn();
  let onLogsCallback: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    (useAccount as any).mockReturnValue({
      address: null,
      isConnected: false,
    });

    (useNFTStore as any).mockReturnValue({
      setCurrentAddress: mockSetCurrentAddress,
      resetState: mockResetState,
      currentAddress: null,
      startAccountSwitch: mockStartAccountSwitch,
      completeAccountSwitch: mockCompleteAccountSwitch,
      isSwitchingAccount: false,
    });

    (useNFTData as any).mockReturnValue({
      forceRefresh: mockForceRefresh,
    });

    (useWatchContractEvent as any).mockImplementation((config: any) => {
      onLogsCallback = config.onLogs;
    });
  });

  it('renders all child components', () => {
    const { container } = renderWithWagmi(<MintPageWrapper />);

    expect(container).toHaveTextContent('TokenStatus');
    expect(container).toHaveTextContent('NFTScreen');
    expect(container).toHaveTextContent('ButtonSection');
  });

  it('does not mutate store on initial connection (delegated to useNFTData)', async () => {
    const { rerender } = renderWithWagmi(<MintPageWrapper />);

    // Simulate connection
    (useAccount as any).mockReturnValue({
      address: '0xABC',
      isConnected: true,
    });

    rerender(<MintPageWrapper />);

    // Wrapper should NOT touch store directly
    expect(mockSetCurrentAddress).not.toHaveBeenCalled();
    // And it should not forceRefresh on a mere connection (only on Transfer)
    vi.advanceTimersByTime(300);
    expect(mockForceRefresh).not.toHaveBeenCalled();

    // But the hook should be instantiated
    expect(useNFTData).toHaveBeenCalled();
  });

  it('does not mutate store on account switching (delegated to useNFTData)', async () => {
    // Start with one address
    (useAccount as any).mockReturnValue({
      address: '0xABC',
      isConnected: true,
    });
    (useNFTStore as any).mockReturnValue({
      setCurrentAddress: mockSetCurrentAddress,
      resetState: mockResetState,
      currentAddress: '0xABC',
      startAccountSwitch: mockStartAccountSwitch,
      completeAccountSwitch: mockCompleteAccountSwitch,
      isSwitchingAccount: false,
    });

    const { rerender } = renderWithWagmi(<MintPageWrapper />);

    // Switch to different address
    (useAccount as any).mockReturnValue({
      address: '0xDEF',
      isConnected: true,
    });

    rerender(<MintPageWrapper />);

    // Wrapper should NOT call store mutations for switching anymore
    expect(mockStartAccountSwitch).not.toHaveBeenCalled();
    expect(mockSetCurrentAddress).not.toHaveBeenCalled();

    // No automatic refresh on switch (only on Transfer)
    vi.advanceTimersByTime(300);
    expect(mockForceRefresh).not.toHaveBeenCalled();

    expect(useNFTData).toHaveBeenCalled();
  });

  it('does not mutate store on disconnection (delegated to useNFTData)', () => {
    // Start connected
    (useAccount as any).mockReturnValue({
      address: '0xABC',
      isConnected: true,
    });
    (useNFTStore as any).mockReturnValue({
      setCurrentAddress: mockSetCurrentAddress,
      resetState: mockResetState,
      currentAddress: '0xABC',
      startAccountSwitch: mockStartAccountSwitch,
      completeAccountSwitch: mockCompleteAccountSwitch,
      isSwitchingAccount: false,
    });

    const { rerender } = renderWithWagmi(<MintPageWrapper />);

    // Disconnect
    (useAccount as any).mockReturnValue({
      address: null,
      isConnected: false,
    });

    rerender(<MintPageWrapper />);

    // Wrapper should NOT call reset or set address now
    expect(mockResetState).not.toHaveBeenCalled();
    expect(mockSetCurrentAddress).not.toHaveBeenCalled();
  });

  it('handles NFT transfer events to user', async () => {
    (useAccount as any).mockReturnValue({
      address: '0xABC',
      isConnected: true,
    });

    renderWithWagmi(<MintPageWrapper />);

    // Simulate transfer event to user
    const mockLog = {
      args: {
        from: '0xDEF',
        to: '0xABC',
        tokenId: BigInt(42),
      },
    };

    onLogsCallback([mockLog]);

    expect(sendNotificationEvent).toHaveBeenCalledWith('NFT_RECEIVED', { source: 'watcher' });

    vi.advanceTimersByTime(1500);
    expect(mockForceRefresh).toHaveBeenCalled();
  });

  it('handles NFT transfer events from user', async () => {
    (useAccount as any).mockReturnValue({
      address: '0xABC',
      isConnected: true,
    });

    renderWithWagmi(<MintPageWrapper />);

    // Simulate transfer event from user
    const mockLog = {
      args: {
        from: '0xABC',
        to: '0xDEF',
        tokenId: BigInt(42),
      },
    };

    onLogsCallback([mockLog]);

    expect(sendNotificationEvent).toHaveBeenCalledWith('NFT_TRANSFERRED', { source: 'watcher' });

    vi.advanceTimersByTime(1500);
    expect(mockForceRefresh).toHaveBeenCalled();
  });

  it('ignores transfer events not involving user', () => {
    (useAccount as any).mockReturnValue({
      address: '0xABC',
      isConnected: true,
    });

    renderWithWagmi(<MintPageWrapper />);

    // Simulate transfer event between other addresses
    const mockLog = {
      args: {
        from: '0xDEF',
        to: '0xGHI',
        tokenId: BigInt(42),
      },
    };

    onLogsCallback([mockLog]);

    expect(sendNotificationEvent).not.toHaveBeenCalled();
    expect(mockForceRefresh).not.toHaveBeenCalled();
  });
});
