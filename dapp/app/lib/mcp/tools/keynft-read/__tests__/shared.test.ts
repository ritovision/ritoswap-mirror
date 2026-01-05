// dapp/app/lib/mcp/tools/keynft-read/__tests__/shared.test.ts

// Silence logs
vi.mock('@logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Public env/config (mutable objects so we can tweak in tests)
const publicConfig = { activeChain: 'sepolia' as string };
const publicEnv = { NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME: 'RitoLocal' as string };

vi.mock('@config/public.env', () => ({
  publicConfig,
  publicEnv,
}));

// Minimal contracts deps to satisfy module import
vi.mock('@config/contracts', () => ({
  KEY_TOKEN_ADDRESS: '0x2222222222222222222222222222222222222222',
  fullKeyTokenAbi: [],
  onePerWalletAbi: [],
}));

// No actual RPC
vi.mock('../../utils/contracts', () => ({
  callContract: vi.fn(),
}));

describe('keynft-read shared utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // don't resetModules here so we keep same object references for publicConfig/publicEnv
  });

  it('activeNetworkName maps chains correctly', async () => {
    const shared = await import('../shared');

    publicConfig.activeChain = 'ethereum';
    expect(shared.activeNetworkName()).toBe('Ethereum');

    publicConfig.activeChain = 'sepolia';
    expect(shared.activeNetworkName()).toBe('Sepolia');

    publicConfig.activeChain = 'ritonet';
    publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME = 'MyLocalChain';
    expect(shared.activeNetworkName()).toBe('MyLocalChain');

    publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME = '';
    expect(shared.activeNetworkName()).toBe('RitoNet');

    publicConfig.activeChain = 'weirdchain';
    expect(shared.activeNetworkName()).toBe('weirdchain'); // fallback to raw
  });

  it('shortAddr shortens addresses and leaves non-address intact', async () => {
    const { shortAddr } = await import('../shared');

    expect(shortAddr('0x1111111111111111111111111111111111111111')).toBe('0x1111…1111');
    expect(shortAddr('hello')).toBe('hello');
  });

  it('fmtColor normalizes hex strings with leading #', async () => {
    const { fmtColor } = await import('../shared');

    expect(fmtColor('#abc123')).toBe('#abc123');
    expect(fmtColor('abc123')).toBe('#abc123');
    expect(fmtColor('')).toBeNull();
    expect(fmtColor(undefined)).toBeNull();
  });

  it('parseDec parses number/string or uses fallback', async () => {
    const { parseDec } = await import('../shared');

    expect(parseDec(7, 99n)).toBe(7n);
    expect(parseDec('42', 99n)).toBe(42n);
    expect(parseDec('0042', 99n)).toBe(42n);
    expect(parseDec('not-a-num' as any, 99n)).toBe(99n);
    expect(parseDec(undefined, 99n)).toBe(99n);
  });
});
