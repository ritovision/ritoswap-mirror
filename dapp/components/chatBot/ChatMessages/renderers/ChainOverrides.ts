/**
 * ChainOverrides.ts
 *
 * Small typed module that centralizes hardcoded chain name -> trustwallet key overrides.
 * Exports a lookup helper that normalizes input and returns a matching override (or undefined).
 *
 * This file is pure TypeScript (no JSX) and intentionally tiny so you can add more aliases easily.
 */

type OverrideMap = Record<string, string>;

/** Primary override map: normalized input -> trustwallet assets directory key */
const CHAIN_OVERRIDES: OverrideMap = {
  // Dogecoin
  dogecoin: 'doge',
  doge: 'doge',

  // Binance / BSC variants (map many user inputs to trustwallet's "binance" dir)
  bsc: 'binance',
  binance: 'binance',
  'binance smart chain': 'binance',
  binancesmartchain: 'binance',
  'binance-smart-chain': 'binance',
  bep2: 'binance',
  bep20: 'binance',
  // Ethereum Classic
  'ethereum classic': 'classic',
    classic: 'classic',
    etc: 'classic',
    // fetch
    'fetch.ai': 'fetch',
    'fetch ai': 'fetch',



  // Add more explicit overrides here when needed
};

/** Normalize a string for lookup: trim + lower-case */
function normalize(input?: string): string {
  return (input || '').trim().toLowerCase();
}

/**
 * getOverride
 * Returns the override key (trustwallet dir name) for a given chainName input,
 * or undefined if no override exists.
 */
export function getOverride(chainName?: string): string | undefined {
  const key = normalize(chainName);
  return CHAIN_OVERRIDES[key];
}

/** Export the raw map for debugging or occasional use */
export { CHAIN_OVERRIDES };
