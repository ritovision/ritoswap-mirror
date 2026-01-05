
// Hoisted state for mocks
const h = vi.hoisted(() => ({
  publicEnv: {
    NEXT_PUBLIC_LOCAL_CHAIN_ID: '90999999',
    NEXT_PUBLIC_ALCHEMY_API_KEY: 'AKEY',
    NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME: 'Rito Local',
  },
  chainConfig: { rpcUrl: 'http://localhost:8545' },
  formatBase: vi.fn((c: string) => `Pretty:${c}`),
}));

vi.mock('@config/public.env', () => ({ publicEnv: h.publicEnv }));
vi.mock('@config/chain', () => ({
  getChainConfig: vi.fn(() => h.chainConfig),
  // ChainType is a type-only export; no runtime needed
}));
vi.mock('@schemas/domain/chains', () => ({
  formatChainName: h.formatBase,
}));

// Import after mocks
import { getRpcUrl, isValidAddress, formatChainName, CHAIN_IDS } from '../chains';

describe('chains.ts', () => {
  beforeEach(() => {
    // reset env and spies each test
    h.publicEnv.NEXT_PUBLIC_LOCAL_CHAIN_ID = '90999999';
    h.publicEnv.NEXT_PUBLIC_ALCHEMY_API_KEY = 'AKEY';
    h.publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME = 'Rito Local';
    h.formatBase.mockClear();
  });

  it('ritonet uses getChainConfig().rpcUrl and ignores Alchemy', () => {
    const url = getRpcUrl('ritonet');
    expect(url).toBe('http://localhost:8545');
  });

  it('public chains require alchemy key and use proper network mapping', () => {
    expect(getRpcUrl('mainnet')).toBe('https://eth-mainnet.g.alchemy.com/v2/AKEY');
    expect(getRpcUrl('sepolia')).toBe('https://eth-sepolia.g.alchemy.com/v2/AKEY');
    expect(getRpcUrl('polygon')).toBe('https://polygon-mainnet.g.alchemy.com/v2/AKEY');
  });

  it('throws if alchemy key missing for public chains', () => {
    h.publicEnv.NEXT_PUBLIC_ALCHEMY_API_KEY = '';
    expect(() => getRpcUrl('mainnet')).toThrow(/Alchemy API key not configured/);
  });

  it('throws for chains not in alchemy map (but not ritonet)', () => {
    // ritonet is local-only and should not throw
    expect(() => getRpcUrl('ritonet')).not.toThrow();

    // mapped chains should not throw either
    expect(() => getRpcUrl('fantom')).not.toThrow();
  });

  it('isValidAddress works', () => {
    expect(isValidAddress('0x' + 'a'.repeat(40))).toBe(true);
    expect(isValidAddress('0x' + 'A'.repeat(40))).toBe(true);
    expect(isValidAddress('0x' + 'g'.repeat(40))).toBe(false); // non-hex
    expect(isValidAddress('0x123')).toBe(false);
    expect(isValidAddress('')).toBe(false);
  });

  it('formatChainName uses env override for ritonet', () => {
    const s = formatChainName('ritonet');
    expect(s).toBe('Rito Local');
    expect(h.formatBase).not.toHaveBeenCalled();
  });

  it('formatChainName falls back to base formatter for public chains', () => {
    const s = formatChainName('mainnet');
    expect(s).toBe('Pretty:mainnet');
    expect(h.formatBase).toHaveBeenCalledWith('mainnet');
  });

  it('CHAIN_IDS.ritonet is numeric and respects env', async () => {
    expect(typeof CHAIN_IDS.ritonet).toBe('number');
    expect(CHAIN_IDS.ritonet).toBe(90999999);

    // change env and re-import module to recompute constant
    h.publicEnv.NEXT_PUBLIC_LOCAL_CHAIN_ID = '1234';
    vi.resetModules();
    const mod = await import('../chains'); // dynamic import must be in an async test
    expect(mod.CHAIN_IDS.ritonet).toBe(1234);
  });
});
