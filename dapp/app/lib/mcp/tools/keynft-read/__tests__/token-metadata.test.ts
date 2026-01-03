// c:\Users\Mattj\techstuff\ritoswap-clean\ritoswap1\dapp\app\lib\mcp\tools\keynft-read\__tests__\token-metadata.test.ts
export {};

// helpers to pick result blocks
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

// mock shared: override callContract only
const mockCallContract = vi.fn();
vi.mock('../shared', async () => {
  const actual = await vi.importActual<any>('../shared');
  return {
    ...actual,
    callContract: mockCallContract,
  };
});

describe('keynft-read: handleTokenMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('happy path: returns text+json with URI and Colors, correct labels, correct args', async () => {
    const { handleTokenMetadata } = await import('../actions/token-metadata');

    mockCallContract.mockImplementation(({ functionName, args }: any) => {
      if (functionName === 'getTokenColors') {
        expect(args).toEqual([7n]); // correct bigint arg
        return ['#111111', '#222222'];
      }
      if (functionName === 'tokenURI') {
        expect(args).toEqual([7n]);
        return 'ipfs://meta/7';
      }
      throw new Error(`unexpected call to ${functionName}`);
    });

    const res = await handleTokenMetadata({ tokenId: '7', includeColors: true, includeURI: true });

    // ordering
    expect(res.content).toHaveLength(2);
    expect(res.content[0].type).toBe('text');
    expect(res.content[1].type).toBe('json');

    const text = getTextBlock(res);
    const json = getJsonBlock(res);

    expect(text.text).toContain('Fetched Token Metadata.');
    expect(text.text).toContain('Token #7');
    expect(text.text).toContain('URI ✓');
    expect(text.text).toContain('Colors ✓');

    expect(json.data).toEqual({
      address: '0x9999999999999999999999999999999999999999',
      tokenId: '7',
      tokenURI: 'ipfs://meta/7',
      colors: {
        backgroundColor: '#111111',
        keyColor: '#222222',
      },
    });

    // ensure both calls were made with correct function names/address/abi
    expect(mockCallContract).toHaveBeenCalledWith(
      expect.objectContaining({
        abi: [],
        address: '0x9999999999999999999999999999999999999999',
        functionName: 'getTokenColors',
        args: [7n],
      }),
    );
    expect(mockCallContract).toHaveBeenCalledWith(
      expect.objectContaining({
        abi: [],
        address: '0x9999999999999999999999999999999999999999',
        functionName: 'tokenURI',
        args: [7n],
      }),
    );
  });

  it('toggles off: includeURI=false & includeColors=false → no contract calls, labels show dashes', async () => {
    const { handleTokenMetadata } = await import('../actions/token-metadata');

    const res = await handleTokenMetadata({
      tokenId: '5',
      includeURI: false,
      includeColors: false,
    });

    expect(mockCallContract).not.toHaveBeenCalled();

    const text = getTextBlock(res);
    const json = getJsonBlock(res);

    expect(text.text).toContain('Token #5');
    expect(text.text).toContain('URI —');
    expect(text.text).toContain('Colors —');

    expect(json.data).toEqual({
      address: '0x9999999999999999999999999999999999999999',
      tokenId: '5',
      tokenURI: undefined,
      colors: undefined,
    });
  });

  it('missing values: when calls resolve to undefined, shows "missing" labels and omits payload fields', async () => {
    const { handleTokenMetadata } = await import('../actions/token-metadata');

    mockCallContract.mockImplementation(({ functionName }: any) => {
      if (functionName === 'getTokenColors') return undefined; // treated as missing
      if (functionName === 'tokenURI') return undefined;       // treated as missing
      throw new Error(`unexpected call to ${functionName}`);
    });

    const res = await handleTokenMetadata({ tokenId: '9', includeColors: true, includeURI: true });
    const text = getTextBlock(res);
    const json = getJsonBlock(res);

    expect(text.text).toContain('Token #9');
    expect(text.text).toContain('URI missing');
    expect(text.text).toContain('Colors missing');

    expect(json.data).toEqual({
      address: '0x9999999999999999999999999999999999999999',
      tokenId: '9',
      tokenURI: undefined,
      colors: undefined,
    });
  });

  it('error path: when a call rejects, returns errorResultShape and logs', async () => {
    const { handleTokenMetadata } = await import('../actions/token-metadata');

    mockCallContract.mockImplementation(({ functionName }: any) => {
      if (functionName === 'getTokenColors') return ['#abc', '#def'];
      if (functionName === 'tokenURI') throw new Error('boom');
      throw new Error(`unexpected call to ${functionName}`);
    });

    const res = await handleTokenMetadata({ tokenId: '1', includeColors: true, includeURI: true });

    expect((res as any).isError).toBe(true);
    const text = getTextBlock(res);
    expect(text.text).toContain('boom');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'token metadata failed',
      expect.objectContaining({ tokenId: '1', err: expect.stringContaining('boom') }),
    );
  });

  it('invalid tokenId → throws ToolFailure (not captured as errorResultShape) and does not log', async () => {
    const { handleTokenMetadata } = await import('../actions/token-metadata');
    // Import ToolFailure AFTER resetModules so class identity matches
    const { ToolFailure } = await import('../../tool-errors');

    await expect(
      handleTokenMetadata({ tokenId: 'abc' }),
    ).rejects.toBeInstanceOf(ToolFailure);

    await expect(
      handleTokenMetadata({ tokenId: '-1' }),
    ).rejects.toBeInstanceOf(ToolFailure);

    // no logger call because it fails before try/catch
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
