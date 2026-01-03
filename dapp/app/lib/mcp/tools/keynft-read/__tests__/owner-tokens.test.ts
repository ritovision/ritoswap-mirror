// c:\Users\Mattj\techstuff\ritoswap-clean\ritoswap1\dapp\app\lib\mcp\tools\keynft-read\__tests__\owner-tokens.test.ts
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

// mock shared: override callContract only; keep OWNER_REGEX, etc.
const mockCallContract = vi.fn();
vi.mock('../shared', async () => {
  const actual = await vi.importActual<any>('../shared');
  return {
    ...actual,
    callContract: mockCallContract,
  };
});

describe('keynft-read: handleOwnerTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // removed vi.resetModules()
  });

  it('happy path: returns text+json with token list (<= cap), correct args and pluralization', async () => {
    const { handleOwnerTokens } = await import('../actions/owner-tokens');

    const OWNER = '0x1111111111111111111111111111111111111111';
    mockCallContract.mockImplementation(({ functionName, args }: any) => {
      if (functionName === 'tokensOfOwner') {
        expect(args).toEqual([OWNER]);
        return [1n, 5n, 42n];
      }
      throw new Error(`unexpected call to ${functionName}`);
    });

    const res = await handleOwnerTokens({ owner: OWNER });

    // order
    expect(res.content).toHaveLength(2);
    expect(res.content[0].type).toBe('text');
    expect(res.content[1].type).toBe('json');

    const text = getTextBlock(res);
    const json = getJsonBlock(res);

    expect(text.text).toContain('Fetched Owner Tokens.');
    expect(text.text).toContain(`${OWNER} holds 3 tokens: #1, #5, #42`);

    expect(json.data).toEqual({
      address: '0x9999999999999999999999999999999999999999',
      owner: OWNER,
      tokenIds: ['1', '5', '42'],
      total: 3,
    });

    expect(mockCallContract).toHaveBeenCalledWith(
      expect.objectContaining({
        abi: [],
        address: '0x9999999999999999999999999999999999999999',
        functionName: 'tokensOfOwner',
        args: [OWNER],
      }),
    );
  });

  it('zero tokens: concise summary and empty payload', async () => {
    const { handleOwnerTokens } = await import('../actions/owner-tokens');

    const OWNER = '0x2222222222222222222222222222222222222222';
    mockCallContract.mockImplementation(({ functionName }: any) => {
      if (functionName === 'tokensOfOwner') return [];
      throw new Error(`unexpected call to ${functionName}`);
    });

    const res = await handleOwnerTokens({ owner: OWNER });
    const text = getTextBlock(res);
    const json = getJsonBlock(res);

    expect(text.text).toContain('Fetched Owner Tokens.');
    expect(text.text).toContain(`${OWNER} holds 0 tokens`);

    expect(json.data).toEqual({
      address: '0x9999999999999999999999999999999999999999',
      owner: OWNER,
      tokenIds: [],
      total: 0,
    });
  });

  it('summarize with +N more when token count exceeds cap (10)', async () => {
    const { handleOwnerTokens } = await import('../actions/owner-tokens');

    const OWNER = '0x3333333333333333333333333333333333333333';
    const ids = Array.from({ length: 12 }, (_, i) => BigInt(i)); // 0..11
    mockCallContract.mockImplementation(({ functionName }: any) => {
      if (functionName === 'tokensOfOwner') return ids;
      throw new Error(`unexpected call to ${functionName}`);
    });

    const res = await handleOwnerTokens({ owner: OWNER });
    const text = getTextBlock(res);
    const json = getJsonBlock(res);

    // first 10 ids listed, then "+2 more"
    expect(text.text).toContain(
      `${OWNER} holds 12 tokens: #0, #1, #2, #3, #4, #5, #6, #7, #8, #9 +2 more`,
    );

    expect(json.data.tokenIds).toEqual(ids.map((n) => n.toString()));
    expect(json.data.total).toBe(12);
  });

  it('error path: callContract throws -> returns errorResultShape and logs', async () => {
    const { handleOwnerTokens } = await import('../actions/owner-tokens');

    const OWNER = '0x4444444444444444444444444444444444444444';
    mockCallContract.mockImplementation(({ functionName }: any) => {
      if (functionName === 'tokensOfOwner') throw new Error('boom');
      throw new Error(`unexpected call to ${functionName}`);
    });

    const res = await handleOwnerTokens({ owner: OWNER });

    expect((res as any).isError).toBe(true);
    const text = getTextBlock(res);
    expect(text.text).toContain('boom');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'tokensOfOwner failed',
      expect.objectContaining({ owner: OWNER, err: expect.stringContaining('boom') }),
    );
  });

  it('validation: invalid owner and zero address → throws ToolFailure and does not log', async () => {
    const { handleOwnerTokens } = await import('../actions/owner-tokens');
    const { ToolFailure } = await import('../../tool-errors'); // import still valid

    await expect(handleOwnerTokens({ owner: '0x123' })).rejects.toBeInstanceOf(ToolFailure);

    await expect(
      handleOwnerTokens({ owner: '0x0000000000000000000000000000000000000000' }),
    ).rejects.toBeInstanceOf(ToolFailure);

    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockCallContract).not.toHaveBeenCalled();
  });
});
