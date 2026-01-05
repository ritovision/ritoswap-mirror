// c:\Users\Mattj\techstuff\ritoswap-clean\ritoswap1\dapp\app\lib\mcp\tools\keynft-read\__tests__\total-supply.test.ts
export {};
// ---- helpers to find blocks from the tool result ----
const getTextBlock = (res: any) => res.content.find((c: any) => c.type === 'text')!;
const getJsonBlock = (res: any) => res.content.find((c: any) => c.type === 'json')!;

// ---- mock logger ----
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};
vi.mock('@logger', () => ({
  createLogger: vi.fn(() => mockLogger),
}));

// ---- mock contracts config ----
vi.mock('@config/contracts', () => ({
  KEY_TOKEN_ADDRESS: '0x9999999999999999999999999999999999999999',
  fullKeyTokenAbi: [],
  onePerWalletAbi: [],
}));

// ---- mock types helpers (textResult/jsonResult) to keep it simple ----
vi.mock('../../types', () => ({
  textResult: (text: string) => ({ content: [{ type: 'text', text }] }),
  jsonResult: (data: unknown) => ({ content: [{ type: 'json', data }] }),
}));

// ---- mock shared: only override what we need ----
const mockCallContract = vi.fn();
const mockActiveNetworkName = vi.fn();
const mockShortAddr = vi.fn();
vi.mock('../shared', async () => {
  const actual = await vi.importActual<any>('../shared');
  return {
    ...actual,
    callContract: mockCallContract,
    activeNetworkName: mockActiveNetworkName,
    shortAddr: mockShortAddr,
  };
});

describe('keynft-read: handleTotalSupply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns text + json with totalSupply and logs success', async () => {
    const { handleTotalSupply } = await import('../actions/total-supply');

    mockCallContract.mockImplementation(({ functionName }: any) => {
      if (functionName === 'totalSupply') return 42n;
      throw new Error(`unexpected call to ${functionName}`);
    });
    mockActiveNetworkName.mockReturnValue('TestNet');
    mockShortAddr.mockReturnValue('0x9999…9999');

    const res = await handleTotalSupply();

    // structure
    expect(Array.isArray(res.content)).toBe(true);
    const text = getTextBlock(res);
    const json = getJsonBlock(res);

    // text content
    expect(text.text).toBe('Key NFT total supply on TestNet: 42 (0x9999…9999)');

    // json content
    expect(json.data).toEqual({
      address: '0x9999999999999999999999999999999999999999',
      totalSupply: '42',
      networkName: 'TestNet',
    });

    // logger call
    expect(mockLogger.info).toHaveBeenCalledWith(
      'totalSupply ok',
      {
        address: '0x9999999999999999999999999999999999999999',
        totalSupply: '42',
        networkName: 'TestNet',
      },
    );
  });

  it('returns errorResultShape on failure and logs error', async () => {
    const { handleTotalSupply } = await import('../actions/total-supply');

    mockCallContract.mockImplementation(({ functionName }: any) => {
      if (functionName === 'totalSupply') throw new Error('boom');
      throw new Error(`unexpected call to ${functionName}`);
    });
    mockActiveNetworkName.mockReturnValue('TestNet'); // not used on error
    mockShortAddr.mockReturnValue('0x9999…9999');     // not used on error

    const res = await handleTotalSupply();

    // error shape
    expect((res as any).isError).toBe(true);
    const text = getTextBlock(res);
    expect(text.text).toContain('boom');

    // logger call
    expect(mockLogger.error).toHaveBeenCalledWith(
      'totalSupply failed',
      expect.objectContaining({ err: expect.stringContaining('boom') }),
    );
  });
});
