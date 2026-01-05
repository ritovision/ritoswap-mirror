// dapp/app/lib/mcp/tools/keynft-read/__tests__/balance.test.ts

export {};

// Silence logs
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};
vi.mock('@logger', () => ({
  createLogger: vi.fn(() => mockLogger),
}));

// Public env/config stable defaults
vi.mock('@config/public.env', () => ({
  publicConfig: { activeChain: 'sepolia' },
  publicEnv: { NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME: 'RitoLocal' },
}));

// Contracts config stub
vi.mock('@config/contracts', () => ({
  KEY_TOKEN_ADDRESS: '0x2222222222222222222222222222222222222222',
  fullKeyTokenAbi: [],
  onePerWalletAbi: [],
}));

// ✅ IMPORTANT: mock the module that balance.ts actually imports from
const mockCallContract = vi.fn();
vi.mock('../shared', async () => {
  const actual = await vi.importActual<any>('../shared');
  return {
    ...actual,
    callContract: mockCallContract,
  };
});

describe('keynft-read: handleBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('throws when owner is missing', async () => {
    const { handleBalance } = await import('../actions/balance');

    await expect(handleBalance({} as any)).rejects.toThrow(/Not signed in/i);
    expect(mockLogger.warn).toHaveBeenCalledWith('balanceOf aborted: no owner');
  });

  it('throws when owner is invalid', async () => {
    const { handleBalance } = await import('../actions/balance');

    await expect(handleBalance({ owner: '0x123' })).rejects.toThrow(/Invalid address/i);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'balanceOf aborted: invalid owner address',
      expect.objectContaining({ owner: '0x123' }),
    );
  });

  it('returns text + json on success', async () => {
    const { handleBalance } = await import('../actions/balance');

    const owner = '0x1111111111111111111111111111111111111111';

    mockCallContract.mockResolvedValueOnce(2n);

    const result = await handleBalance({ owner });

    // should be combined text + json results
    expect(result.content).toHaveLength(2);

    const text = result.content.find((c: any) => c.type === 'text')!;
    const json = result.content.find((c: any) => c.type === 'json')!;

    expect(text.text).toContain('0x1111…1111');
    expect(text.text).toContain('2 keys');
    expect(text.text).toContain('Sepolia');
    expect(text.text).toContain('0x2222…2222'); // contract short address

    expect(json.data).toMatchObject({
      address: '0x2222222222222222222222222222222222222222',
      owner,
      balance: '2',
      networkName: 'Sepolia',
    });

    expect(mockLogger.info).toHaveBeenCalledWith(
      'balanceOf ok',
      expect.objectContaining({ owner, balance: '2', networkName: 'Sepolia' }),
    );
  });

  it('returns errorResult on read failure', async () => {
    const { handleBalance } = await import('../actions/balance');

    mockCallContract.mockRejectedValueOnce(new Error('RPC boom'));

    const owner = '0x1111111111111111111111111111111111111111';
    const result = await handleBalance({ owner });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('RPC boom');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'balanceOf failed',
      expect.objectContaining({ owner, err: expect.stringContaining('RPC boom') }),
    );
  });
});
