// c:\Users\Mattj\techstuff\ritoswap-clean\ritoswap1\dapp\app\lib\mcp\tools\keynft-read\__tests__\owner-single.test.ts
export {};
// helpers
const getTextBlock = (res: any) => res.content.find((c: any) => c.type === 'text')!;
const getJsonBlock = (res: any) => res.content.find((c: any) => c.type === 'json')!;

// mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};
vi.mock('@logger', () => ({
  createLogger: vi.fn(() => mockLogger),
}));

// mock contracts config
vi.mock('@config/contracts', () => ({
  KEY_TOKEN_ADDRESS: '0x9999999999999999999999999999999999999999',
  fullKeyTokenAbi: [],
  onePerWalletAbi: [],
}));

// mock public environment to prevent chain initialization
vi.mock('@config/public.env', () => ({
  publicConfig: { activeChain: 'sepolia' },
  publicEnv: {
    NEXT_PUBLIC_ACTIVE_CHAIN: 'sepolia',
    NEXT_PUBLIC_DOMAIN: 'localhost:3000',
    NEXT_PUBLIC_ALCHEMY_API_KEY: 'test-key',
  },
}));

// mock chain config to prevent network calls
vi.mock('@config/chain', () => ({
  getActiveChain: vi.fn(() => 'sepolia'),
  Chain: { ETHEREUM: 'ethereum', SEPOLIA: 'sepolia', RITONET: 'ritonet' },
}));

// mock shared: override callContract only
const mockCallContract = vi.fn();
vi.mock('../shared', async () => {
  const actual = await vi.importActual<any>('../shared');
  return {
    ...actual,
    callContract: mockCallContract,
  };
});

describe('keynft-read: handleOwnerSingle', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // removed vi.resetModules()
  });

  it('has key: returns text+json, includes key #id and correct args', async () => {
    const { handleOwnerSingle } = await import('../actions/owner-single');

    const OWNER = '0x1111111111111111111111111111111111111111';
    mockCallContract.mockImplementation(({ functionName, args }: any) => {
      if (functionName === 'getTokenOfOwner') {
        expect(args).toEqual([OWNER]);
        return [123n, true] as [bigint, boolean];
      }
      throw new Error(`unexpected call to ${functionName}`);
    });

    const res = await handleOwnerSingle({ owner: OWNER });

    // order
    expect(res.content).toHaveLength(2);
    expect(res.content[0].type).toBe('text');
    expect(res.content[1].type).toBe('json');

    const text = getTextBlock(res);
    const json = getJsonBlock(res);

    expect(text.text).toContain('Fetched Key Ownership.');
    expect(text.text).toContain(`${OWNER} has key #123`);

    expect(json.data).toEqual({
      address: '0x9999999999999999999999999999999999999999',
      owner: OWNER,
      tokenId: '123',
      hasToken: true,
    });

    expect(mockCallContract).toHaveBeenCalledWith(
      expect.objectContaining({
        abi: [],
        address: '0x9999999999999999999999999999999999999999',
        functionName: 'getTokenOfOwner',
        args: [OWNER],
      }),
    );
  });

  it('no key: returns text+json with "has no key" and empty tokenId string', async () => {
    const { handleOwnerSingle } = await import('../actions/owner-single');

    const OWNER = '0x2222222222222222222222222222222222222222';
    mockCallContract.mockImplementation(({ functionName }: any) => {
      if (functionName === 'getTokenOfOwner') return [0n, false] as [bigint, boolean];
      throw new Error(`unexpected call to ${functionName}`);
    });

    const res = await handleOwnerSingle({ owner: OWNER });

    const text = getTextBlock(res);
    const json = getJsonBlock(res);

    expect(text.text).toContain('Fetched Key Ownership.');
    expect(text.text).toContain(`${OWNER} has no key`);

    expect(json.data).toEqual({
      address: '0x9999999999999999999999999999999999999999',
      owner: OWNER,
      tokenId: '0',
      hasToken: false,
    });
  });

  it('error path: call rejects → returns errorResultShape and logs', async () => {
    const { handleOwnerSingle } = await import('../actions/owner-single');

    const OWNER = '0x3333333333333333333333333333333333333333';
    mockCallContract.mockImplementation(({ functionName }: any) => {
      if (functionName === 'getTokenOfOwner') throw new Error('boom');
      throw new Error(`unexpected call to ${functionName}`);
    });

    const res = await handleOwnerSingle({ owner: OWNER });

    expect((res as any).isError).toBe(true);
    const text = getTextBlock(res);
    expect(text.text).toContain('boom');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'getTokenOfOwner failed',
      expect.objectContaining({ owner: OWNER, err: expect.stringContaining('boom') }),
    );
  });

  it('validation: invalid owner → throws ToolFailure and does not call contract or log', async () => {
    const { handleOwnerSingle } = await import('../actions/owner-single');
    const { ToolFailure } = await import('../../tool-errors'); // still fine without reset

    await expect(handleOwnerSingle({ owner: '0x123' })).rejects.toBeInstanceOf(ToolFailure);

    expect(mockCallContract).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
