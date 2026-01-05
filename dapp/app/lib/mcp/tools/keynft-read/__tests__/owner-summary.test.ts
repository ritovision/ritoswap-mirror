// c:\Users\Mattj\techstuff\ritoswap-clean\ritoswap1\dapp\app\lib\mcp\tools\keynft-read\__tests__\owner-summary.test.ts
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

// mock shared: override callContract only (keep OWNER_REGEX & fmtColor)
const mockCallContract = vi.fn();
vi.mock('../shared', async () => {
  const actual = await vi.importActual<any>('../shared');
  return {
    ...actual,
    callContract: mockCallContract,
  };
});

describe('keynft-read: handleOwnerSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('happy path: enriches up to maxTokens, formats colors, and builds summary with properties', async () => {
    const { handleOwnerSummary } = await import('../actions/owner-summary');

    const OWNER = '0x1111111111111111111111111111111111111111';

    mockCallContract.mockImplementation(({ functionName, args }: any) => {
      if (functionName === 'balanceOf') {
        expect(args).toEqual([OWNER]);
        return 3n;
      }
      if (functionName === 'tokensOfOwner') {
        expect(args).toEqual([OWNER]);
        return [5n, 7n, 9n];
      }
      if (functionName === 'getTokenOfOwner') {
        // MUST return a Promise because the code calls `.catch()` on it immediately.
        expect(args).toEqual([OWNER]);
        return Promise.resolve<[bigint, boolean]>([0n, false]);
      }
      if (functionName === 'getTokenColors') {
        const id = args[0] as bigint;
        if (id === 5n) return ['111111', '222222']; // fmtColor adds '#'
        if (id === 7n) return ['#aaaaaa', '#bbbbbb'];
        throw new Error(`unexpected getTokenColors id=${String(id)}`);
      }
      if (functionName === 'tokenURI') {
        const id = args[0] as bigint;
        if (id === 5n) return 'ipfs://meta/5';
        if (id === 7n) return 'ipfs://meta/7';
        throw new Error(`unexpected tokenURI id=${String(id)}`);
      }
      throw new Error(`unexpected call to ${functionName}`);
    });

    const res = await handleOwnerSummary({
      owner: OWNER,
      includeColors: true,
      includeURI: true,
      maxTokens: 2, // cap enrichment to first 2 ids
    });

    // order
    expect(res.content).toHaveLength(2);
    expect(res.content[0].type).toBe('text');
    expect(res.content[1].type).toBe('json');

    const text = getTextBlock(res);
    const json = getJsonBlock(res);

    // summary text
    expect(text.text).toContain('Fetched Owner Summary.');
    expect(text.text).toContain(`${OWNER} has 3 tokens`);
    expect(text.text).toContain(
      `Properties: TokenID #5, BG #111111, KeyColor #222222 (0x9999999999999999999999999999999999999999)`,
    );

    // payload
    expect(json.data).toEqual({
      address: '0x9999999999999999999999999999999999999999',
      owner: OWNER,
      balance: '3',
      tokenIds: ['5', '7', '9'],
      enrichedCount: 2,
      tokens: [
        { tokenId: '5', tokenURI: 'ipfs://meta/5', colors: { backgroundColor: '111111', keyColor: '222222' } },
        { tokenId: '7', tokenURI: 'ipfs://meta/7', colors: { backgroundColor: '#aaaaaa', keyColor: '#bbbbbb' } },
      ],
    });

    // initial contract calls
    expect(mockCallContract).toHaveBeenCalledWith(
      expect.objectContaining({
        abi: [],
        address: '0x9999999999999999999999999999999999999999',
        functionName: 'balanceOf',
        args: [OWNER],
      }),
    );
    expect(mockCallContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'tokensOfOwner',
        args: [OWNER],
      }),
    );
    expect(mockCallContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'getTokenOfOwner',
        args: [OWNER],
      }),
    );

    // ensure NO enrichment for id 9n (beyond cap)
    expect(
      mockCallContract.mock.calls.some(
        (call) =>
          call[0]?.functionName === 'tokenURI' && String(call[0]?.args?.[0]) === '9',
      ),
    ).toBe(false);
    expect(
      mockCallContract.mock.calls.some(
        (call) =>
          call[0]?.functionName === 'getTokenColors' && String(call[0]?.args?.[0]) === '9',
      ),
    ).toBe(false);
  });

  it('fallback: tokensOfOwner empty, one-per says has token → ids come from one-per; no enrichment data but still prints Properties with N/A', async () => {
    const { handleOwnerSummary } = await import('../actions/owner-summary');

    const OWNER = '0x2222222222222222222222222222222222222222';

    mockCallContract.mockImplementation(({ functionName }: any) => {
      if (functionName === 'balanceOf') return 1n;
      if (functionName === 'tokensOfOwner') return [];
      if (functionName === 'getTokenOfOwner') {
        // MUST return a Promise (code uses `.catch()` directly)
        return Promise.resolve<[bigint, boolean]>([123n, true]);
      }
      // enrichment should NOT be called when include flags are false (but tokens array still built)
      if (functionName === 'getTokenColors' || functionName === 'tokenURI') {
        throw new Error('enrichment should not be called when include flags are false');
      }
      throw new Error(`unexpected call to ${functionName}`);
    });

    const res = await handleOwnerSummary({
      owner: OWNER,
      includeColors: false,
      includeURI: false,
      maxTokens: 50,
    });

    const text = getTextBlock(res);
    const json = getJsonBlock(res);

    expect(text.text).toContain('Fetched Owner Summary.');
    expect(text.text).toContain(`${OWNER} has 1 token`);
    // Properties line IS present with N/A because tokens array contains a stub entry
    expect(text.text).toContain(
      `Properties: TokenID #123, BG N/A, KeyColor N/A (0x9999999999999999999999999999999999999999)`,
    );

    expect(json.data).toEqual({
      address: '0x9999999999999999999999999999999999999999',
      owner: OWNER,
      balance: '1',
      tokenIds: ['123'],
      enrichedCount: 1, // one stub token built
      tokens: [
        { tokenId: '123', tokenURI: undefined, colors: undefined },
      ],
    });
  });

  it('error path: any call throws → returns errorResultShape and logs', async () => {
    const { handleOwnerSummary } = await import('../actions/owner-summary');

    const OWNER = '0x3333333333333333333333333333333333333333';

    mockCallContract.mockImplementation(({ functionName }: any) => {
      if (functionName === 'balanceOf') throw new Error('kaboom');
      throw new Error(`unexpected call to ${functionName}`);
    });

    const res = await handleOwnerSummary({
      owner: OWNER,
      includeColors: true,
      includeURI: true,
    });

    expect((res as any).isError).toBe(true);
    const text = getTextBlock(res);
    expect(text.text).toContain('kaboom');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'owner summary failed',
      expect.objectContaining({ owner: OWNER, err: expect.stringContaining('kaboom') }),
    );
  });

  it('validation: invalid owner and zero address → throws ToolFailure and does not log', async () => {
    const { handleOwnerSummary } = await import('../actions/owner-summary');
    const { ToolFailure } = await import('../../tool-errors'); // import after reset for class identity

    await expect(
      handleOwnerSummary({ owner: '0x123' }),
    ).rejects.toBeInstanceOf(ToolFailure);

    await expect(
      handleOwnerSummary({ owner: '0x0000000000000000000000000000000000000000' }),
    ).rejects.toBeInstanceOf(ToolFailure);

    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockCallContract).not.toHaveBeenCalled();
  });
});
