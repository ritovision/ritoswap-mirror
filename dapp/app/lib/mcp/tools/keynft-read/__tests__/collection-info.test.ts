// dapp/app/lib/mcp/tools/keynft-read/__tests__/collection-info.test.ts
export {};

// Provide mutable public config/env so tests can tweak them
const publicConfig: any = { activeChain: 'sepolia' };
const publicEnv: any = { NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME: 'RitoLocal' };
vi.mock('@config/public.env', () => ({ publicConfig, publicEnv }));

// Silence logs and capture calls
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};
vi.mock('@logger', () => ({
  createLogger: vi.fn(() => mockLogger),
}));

// Contracts config stub (stable)
vi.mock('@config/contracts', () => ({
  KEY_TOKEN_ADDRESS: '0x2222222222222222222222222222222222222222',
  fullKeyTokenAbi: [],
  onePerWalletAbi: [],
}));

// IMPORTANT: override ../shared.callContract (balance & collection-info import from ../shared)
const mockCallContract = vi.fn();
vi.mock('../shared', async () => {
  // Import actual shared to keep other helpers (shortAddr, activeNetworkName) intact
  const actual = await vi.importActual<any>('../shared');
  return {
    ...actual,
    callContract: mockCallContract,
  };
});

describe('keynft-read: handleCollectionInfo (expanded)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Reset public defaults each test
    publicConfig.activeChain = 'sepolia';
    publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME = 'RitoLocal';
  });

  it('returns text + json on success', async () => {
    const { handleCollectionInfo } = await import('../actions/collection-info');

    mockCallContract
      .mockResolvedValueOnce('KeyNFT') // name
      .mockResolvedValueOnce('KEY');   // symbol

    const result = await handleCollectionInfo();

    // combined text + json
    expect(result.content).toHaveLength(2);

    const text = result.content.find((c: any) => c.type === 'text')!;
    const json = result.content.find((c: any) => c.type === 'json')!;

    expect(text.text).toContain('KeyNFT (KEY) on Sepolia');
    expect(text.text).toContain('0x2222…2222'); // short address

    expect(json.data).toMatchObject({
      address: '0x2222222222222222222222222222222222222222',
      name: 'KeyNFT',
      symbol: 'KEY',
      networkName: 'Sepolia',
    });

    expect(mockLogger.info).toHaveBeenCalledWith(
      'collection info ok',
      expect.objectContaining({
        address: '0x2222222222222222222222222222222222222222',
        name: 'KeyNFT',
        symbol: 'KEY',
        networkName: 'Sepolia',
      }),
    );
  });

  it('calls contract read for both name and symbol with correct params', async () => {
    const { handleCollectionInfo } = await import('../actions/collection-info');

    mockCallContract
      .mockResolvedValueOnce('Alpha') // name
      .mockResolvedValueOnce('A');    // symbol

    await handleCollectionInfo();

    // Ensure we called name then symbol (Promise.all order may not be guaranteed by Promise.all,
    // but the code invokes both calls in the array order — check both were called)
    expect(mockCallContract).toHaveBeenCalledTimes(2);

    expect(mockCallContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'name',
        address: '0x2222222222222222222222222222222222222222',
      }),
    );

    expect(mockCallContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'symbol',
        address: '0x2222222222222222222222222222222222222222',
      }),
    );
  });

  it('handles non-string returns by coercing to string in human text', async () => {
    const { handleCollectionInfo } = await import('../actions/collection-info');

    // Simulate odd contract returns (numbers / null)
    mockCallContract
      .mockResolvedValueOnce(1234 as any) // name
      .mockResolvedValueOnce(null as any); // symbol

    const result = await handleCollectionInfo();

    const text = result.content.find((c: any) => c.type === 'text')!;
    // Non-strings should be stringified in template literals
    expect(text.text).toContain('1234 (null)');
  });

  it('uses activeNetworkName for ritonet when publicEnv override present', async () => {
    const { handleCollectionInfo } = await import('../actions/collection-info');

    // change active chain and local chain name
    publicConfig.activeChain = 'ritonet';
    publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME = 'MyLocalRito';

    mockCallContract
      .mockResolvedValueOnce('MyKey') // name
      .mockResolvedValueOnce('MK');   // symbol

    const result = await handleCollectionInfo();

    const text = result.content.find((c: any) => c.type === 'text')!;
    expect(text.text).toContain('on MyLocalRito');
  });

  it('handles empty name gracefully (shows parentheses with symbol)', async () => {
    const { handleCollectionInfo } = await import('../actions/collection-info');

    mockCallContract
      .mockResolvedValueOnce('') // empty name
      .mockResolvedValueOnce('SYM');

    const result = await handleCollectionInfo();

    const text = result.content.find((c: any) => c.type === 'text')!;
    // Should still contain the parentheses even if name empty
    expect(text.text).toContain(' (SYM) on Sepolia');
  });

  it('returns errorResult on read failure', async () => {
    const { handleCollectionInfo } = await import('../actions/collection-info');

    mockCallContract.mockRejectedValueOnce(new Error('RPC fail'));

    const result = await handleCollectionInfo();

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('RPC fail');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'collection info failed',
      expect.objectContaining({ err: expect.stringContaining('RPC fail') }),
    );
  });
});
