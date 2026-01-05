import {
  SupportedChainSchema,
  isSupportedChain,
  formatChainName,
  CHAIN_DISPLAY_NAMES,
  CHAIN_NATIVE_SYMBOLS,
} from '../chains';

describe('chains domain schema', () => {
  it('SupportedChainSchema accepts known chains', () => {
    const valid = Object.keys(CHAIN_DISPLAY_NAMES);
    for (const c of valid) {
      expect(() => SupportedChainSchema.parse(c)).not.toThrow();
    }
  });

  it('SupportedChainSchema rejects unknown chain', () => {
    expect(() => SupportedChainSchema.parse('goerli' as any)).toThrow();
    expect(() => SupportedChainSchema.parse('ETHEREUM' as any)).toThrow();
  });

  it('isSupportedChain works for valid/invalid inputs', () => {
    expect(isSupportedChain('mainnet')).toBe(true);
    expect(isSupportedChain('sepolia')).toBe(true);
    expect(isSupportedChain('Goerli')).toBe(false);
    expect(isSupportedChain('unknown')).toBe(false);
    expect(isSupportedChain(123 as any)).toBe(false);
    expect(isSupportedChain(null as any)).toBe(false);
  });

  it('formatChainName returns friendly names', () => {
    expect(formatChainName('mainnet')).toBe('Ethereum');
    expect(formatChainName('ritonet')).toBe('RitoNet');
  });

  it('native symbol mapping has expected values', () => {
    expect(CHAIN_NATIVE_SYMBOLS.mainnet).toBe('ETH');
    expect(CHAIN_NATIVE_SYMBOLS.sepolia).toBe('ETH');
    expect(CHAIN_NATIVE_SYMBOLS.polygon).toBe('MATIC');
    expect(CHAIN_NATIVE_SYMBOLS.avalanche).toBe('AVAX');
  });
});
