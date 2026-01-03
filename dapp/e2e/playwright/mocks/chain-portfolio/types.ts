// dapp/e2e/playwright/mocks/chain-portfolio/types.ts

export type PortfolioTokenType = 'ERC-20' | 'ERC-721' | 'ERC-1155';

export interface BaseAsset {
  type: PortfolioTokenType;
  contractAddress: `0x${string}`;
}

export interface ERC20Asset extends BaseAsset {
  type: 'ERC-20';
  symbol: string;
  name: string;
  decimals: number;
  balance: string; // stringified integer (wei-style or token units; UI will format)
}

export interface ERC721Asset extends BaseAsset {
  type: 'ERC-721';
  tokenId: string; // decimal string
  name?: string;
  image?: string;
}

export interface ERC1155Asset extends BaseAsset {
  type: 'ERC-1155';
  tokenId: string;   // decimal string
  balance: string;   // stringified integer quantity
  name?: string;
  image?: string;
}

export type AnyAsset = ERC20Asset | ERC721Asset | ERC1155Asset;

export interface ChainPortfolioData {
  erc20: ERC20Asset[];
  erc721: ERC721Asset[];
  erc1155: ERC1155Asset[];
}

export type PortfolioDataset = Record<number, ChainPortfolioData>;

export interface PortfolioMockOptions {
  /**
   * URL patterns to intercept (glob). We only fulfill when we also detect
   * chainId + tokenType in the query (or JSON body). Otherwise we fallback().
   * Defaults cover common /api/portfolio assets endpoints.
   */
  routes?: string[];
  /** Dataset keyed by chainId; easy to extend to more chains/tokens. */
  dataset: PortfolioDataset;
  /** Page size if you want to simulate pagination (cursor/page param). */
  pageSize?: number;
  /** Debug logging */
  debug?: boolean;
}
