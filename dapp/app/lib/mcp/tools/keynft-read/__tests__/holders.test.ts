// c:\Users\Mattj\techstuff\ritoswap-clean\ritoswap1\dapp\app\lib\mcp\tools\keynft-read\__tests__\holders.test.ts

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

// Contracts config stub (stable)
vi.mock('@config/contracts', () => ({
  KEY_TOKEN_ADDRESS: '0x9999999999999999999999999999999999999999',
  fullKeyTokenAbi: [],
  onePerWalletAbi: [],
}));

// Only override callContract; keep other shared helpers as-is
const mockCallContract = vi.fn();
vi.mock('../shared', async () => {
  const actual = await vi.importActual<any>('../shared');
  return {
    ...actual,
    callContract: mockCallContract,
  };
});

// ---- small helpers to dodge TS union pain ----
const getTextBlock = (res: any) =>
  res.content.find((c: any) => c.type === 'text')!;
const getJsonBlock = (res: any) =>
  res.content.find((c: any) => c.type === 'json')!;

describe('keynft-read: handleHolders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns zero holders when totalSupply is 0', async () => {
    const { handleHolders } = await import('../actions/holders');

    mockCallContract.mockImplementation(({ functionName }: any) => {
      if (functionName === 'totalSupply') return Promise.resolve(0n);
      throw new Error(`unexpected call to ${functionName}`);
    });

    const res = await handleHolders({});
    expect(res.content).toHaveLength(2);

    const text = getTextBlock(res);
    const json = getJsonBlock(res);

    expect(text.text).toContain('Fetched Key Holders.');
    expect(text.text).toContain('0 holders (scanned 0/0)');

    expect(json.data).toMatchObject({
      address: '0x9999999999999999999999999999999999999999',
      totalSupply: '0',
      scanned: '0',
      method: 'enumerable',
      holders: [],
      totalHolders: 0,
    });
  });

  it('enumerable path: aggregates balances, applies maxTokens, respects concurrency', async () => {
    const { handleHolders } = await import('../actions/holders');

    const A1 = '0x1111111111111111111111111111111111111111';

    let probeCallCount = 0;
    mockCallContract.mockImplementation(({ functionName, args }: any) => {
      if (functionName === 'totalSupply') return Promise.resolve(3n);

      if (functionName === 'tokenByIndex') {
        const idx = args?.[0] as bigint;
        probeCallCount++;
        
        // First call is probe
        if (probeCallCount === 1) return Promise.resolve(0n);
        
        // Subsequent calls are actual scanning
        if (idx === 0n) return Promise.resolve(10n);
        if (idx === 1n) return Promise.resolve(11n);
        return Promise.reject(new Error(`unexpected tokenByIndex idx=${String(idx)}`));
      }

      if (functionName === 'ownerOf') {
        const tokenId = args?.[0] as bigint;
        if (tokenId === 10n || tokenId === 11n) return Promise.resolve(A1);
        return Promise.reject(new Error(`unexpected ownerOf tokenId=${String(tokenId)}`));
      }

      return Promise.reject(new Error(`unexpected call to ${functionName}`));
    });

    const res = await handleHolders({
      startIndex: '0',
      maxTokens: '2',
      concurrency: 1000,
    });

    expect(res.content).toHaveLength(2);

    const text = getTextBlock(res);
    const json = getJsonBlock(res);

    expect(text.text).toContain('Fetched Key Holders.');
    expect(text.text).toContain('1 holders (scanned 2/3)');
    expect(text.text).toContain('via enumerable');

    expect(json.data).toMatchObject({
      address: '0x9999999999999999999999999999999999999999',
      totalSupply: '3',
      scanned: '2',
      method: 'enumerable',
      totalHolders: 1,
    });
    expect(json.data.holders).toEqual([{ address: A1, balance: '2' }]);
  });

  it('returns zero scanned when toScan <= 0 (startIndex beyond supply)', async () => {
    const { handleHolders } = await import('../actions/holders');

    mockCallContract.mockImplementation(({ functionName }: any) => {
      if (functionName === 'totalSupply') return Promise.resolve(5n);
      return Promise.reject(new Error(`unexpected call to ${functionName}`));
    });

    const res = await handleHolders({ startIndex: '5' });

    expect(res.content).toHaveLength(2);

    const text = getTextBlock(res);
    const json = getJsonBlock(res);

    expect(text.text).toContain('0 holders (scanned 0/5)');
    expect(json.data).toMatchObject({
      totalSupply: '5',
      scanned: '0',
      holders: [],
      totalHolders: 0,
    });
  });

  it('sequential fallback when tokenByIndex unsupported; skips ZERO/failed lookups', async () => {
    const { handleHolders } = await import('../actions/holders');

    const A1 = '0x1111111111111111111111111111111111111111';
    const ZERO = '0x0000000000000000000000000000000000000000';

    mockCallContract.mockImplementation(({ functionName, args }: any) => {
      if (functionName === 'totalSupply') return Promise.resolve(4n);

      if (functionName === 'tokenByIndex') {
        return Promise.reject(new Error('no enumerable'));
      }

      if (functionName === 'ownerOf') {
        const tokenId = args?.[0] as bigint;
        if (tokenId === 0n) return Promise.resolve(A1);
        if (tokenId === 1n) return Promise.reject(new Error('ownerOf fail'));
        if (tokenId === 2n) return Promise.resolve(ZERO);
        if (tokenId === 3n) return Promise.resolve(A1);
        return Promise.reject(new Error(`unexpected ownerOf tokenId=${String(tokenId)}`));
      }

      return Promise.reject(new Error(`unexpected call to ${functionName}`));
    });

    const res = await handleHolders({
      startIndex: 0,
      maxTokens: 4,
      concurrency: 3,
    });

    const json = getJsonBlock(res);
    const text = getTextBlock(res);

    expect(json.data.method).toBe('sequential');
    expect(json.data.scanned).toBe('4');
    expect(json.data.totalSupply).toBe('4');
    expect(json.data.holders).toEqual([{ address: A1, balance: '2' }]);
    expect(json.data.totalHolders).toBe(1);

    expect(text.text).toContain('1 holders (scanned 4/4) via sequential');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'tokenByIndex unsupported; falling back to sequential ownerOf() over assumed dense IDs',
      expect.objectContaining({ startIndex: '0' }),
    );
  });

  it('returns errorResultShape on hard failure', async () => {
    const { handleHolders } = await import('../actions/holders');

    mockCallContract.mockImplementation(({ functionName }: any) => {
      if (functionName === 'totalSupply') return Promise.reject(new Error('boom'));
      return Promise.reject(new Error(`unexpected call to ${functionName}`));
    });

    const res = await handleHolders({});
    expect((res as any).isError).toBe(true);
    const text = getTextBlock(res);
    expect(text.text).toContain('boom');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'holders (enumerable) failed',
      expect.objectContaining({ err: expect.stringContaining('boom') }),
    );
  });

  it('sorting: when balances tie, holders are ordered by address ascending', async () => {
    const { handleHolders } = await import('../actions/holders');

    const A1 = '0x1111111111111111111111111111111111111111';
    const A2 = '0x2222222222222222222222222222222222222222';

    let probeCallCount = 0;
    mockCallContract.mockImplementation(({ functionName, args }: any) => {
      if (functionName === 'totalSupply') return Promise.resolve(2n);

      if (functionName === 'tokenByIndex') {
        const idx = args?.[0] as bigint;
        probeCallCount++;
        
        if (probeCallCount === 1) return Promise.resolve(0n);
        
        if (idx === 0n) return Promise.resolve(5n);
        if (idx === 1n) return Promise.resolve(6n);
        return Promise.reject(new Error(`unexpected tokenByIndex idx=${String(idx)}`));
      }

      if (functionName === 'ownerOf') {
        const tokenId = args?.[0] as bigint;
        if (tokenId === 5n) return Promise.resolve(A2);
        if (tokenId === 6n) return Promise.resolve(A1);
        return Promise.reject(new Error(`unexpected ownerOf tokenId=${String(tokenId)}`));
      }

      return Promise.reject(new Error(`unexpected call to ${functionName}`));
    });

    const res = await handleHolders({ startIndex: 0, maxTokens: 2, concurrency: 25 });

    const json = getJsonBlock(res);
    const text = getTextBlock(res);

    expect(text.text).toContain('2 holders (scanned 2/2) via enumerable');

    expect(json.data.holders).toEqual([
      { address: A1, balance: '1' },
      { address: A2, balance: '1' },
    ]);
    expect(json.data.totalHolders).toBe(2);
  });
});