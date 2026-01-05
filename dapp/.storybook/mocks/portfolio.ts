import { MOCK_DEFAULT_ACCOUNTS } from './mockWagmiConfig';

export const PORTFOLIO_SUPPORTED_CHAIN_IDS = {
  mainnet: 1,
  sepolia: 11155111,
  polygon: 137,
  arbitrum: 42161,
  base: 8453,
  optimism: 10,
} as const;

export type PortfolioChainId =
  (typeof PORTFOLIO_SUPPORTED_CHAIN_IDS)[keyof typeof PORTFOLIO_SUPPORTED_CHAIN_IDS];

export const PORTFOLIO_DEFAULT_CHAIN_IDS: readonly PortfolioChainId[] = [
  PORTFOLIO_SUPPORTED_CHAIN_IDS.mainnet,
  PORTFOLIO_SUPPORTED_CHAIN_IDS.sepolia,
  PORTFOLIO_SUPPORTED_CHAIN_IDS.polygon,
  PORTFOLIO_SUPPORTED_CHAIN_IDS.arbitrum,
  PORTFOLIO_SUPPORTED_CHAIN_IDS.base,
  PORTFOLIO_SUPPORTED_CHAIN_IDS.optimism,
];

export const PORTFOLIO_DEFAULT_ADDRESS = MOCK_DEFAULT_ACCOUNTS[0] as `0x${string}`;
export const PORTFOLIO_SECONDARY_ADDRESS = '0x00000000000000000000000000000000000000b0' as `0x${string}`;

export const portfolioChainToggleDefaults = {
  showMainnet: true,
  showSepolia: true,
  showPolygon: true,
  showArbitrum: true,
  showBase: true,
  showOptimism: true,
} as const;

export const portfolioChainToggleArgTypes = {
  showMainnet: { control: { type: 'boolean' as const }, table: { category: 'Enabled Chains' } },
  showSepolia: { control: { type: 'boolean' as const }, table: { category: 'Enabled Chains' } },
  showPolygon: { control: { type: 'boolean' as const }, table: { category: 'Enabled Chains' } },
  showArbitrum: { control: { type: 'boolean' as const }, table: { category: 'Enabled Chains' } },
  showBase: { control: { type: 'boolean' as const }, table: { category: 'Enabled Chains' } },
  showOptimism: { control: { type: 'boolean' as const }, table: { category: 'Enabled Chains' } },
};

export const portfolioTokenToggleDefaults = {
  selectErc20: true,
  selectErc721: true,
  selectErc1155: false,
} as const;

export const portfolioTokenToggleArgTypes = {
  selectErc20: { control: { type: 'boolean' as const }, table: { category: 'Selected Tokens' } },
  selectErc721: { control: { type: 'boolean' as const }, table: { category: 'Selected Tokens' } },
  selectErc1155: { control: { type: 'boolean' as const }, table: { category: 'Selected Tokens' } },
};

export function createSvgDataUri(label: string, opts?: { bg?: string; fg?: string }) {
  const bg = opts?.bg ?? '#111827';
  const fg = opts?.fg ?? '#F9FAFB';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="18" fill="${bg}"/><text x="48" y="54" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="20" fill="${fg}">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

type TokenFixture = {
  contractAddress: `0x${string}`;
  balance: string;
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
};

const ERC20_BY_CHAIN: Record<number, TokenFixture[]> = {
  [PORTFOLIO_SUPPORTED_CHAIN_IDS.mainnet]: [
    {
      contractAddress: '0x0000000000000000000000000000000000001000',
      balance: '1234500000000000000',
      name: 'Mock Ether Wrap',
      symbol: 'mWETH',
      decimals: 18,
      logo: createSvgDataUri('W'),
    },
    {
      contractAddress: '0x0000000000000000000000000000000000002000',
      balance: '42000000',
      name: 'Mock USD Coin',
      symbol: 'mUSDC',
      decimals: 6,
      logo: createSvgDataUri('U'),
    },
  ],
  [PORTFOLIO_SUPPORTED_CHAIN_IDS.sepolia]: [
    {
      contractAddress: '0x0000000000000000000000000000000000003000',
      balance: '100000000000000000',
      name: 'Mock Sepolia Token',
      symbol: 'mSEP',
      decimals: 18,
      logo: createSvgDataUri('S'),
    },
  ],
  [PORTFOLIO_SUPPORTED_CHAIN_IDS.polygon]: [
    {
      contractAddress: '0x0000000000000000000000000000000000004000',
      balance: '999000000',
      name: 'Mock Polygon Token',
      symbol: 'mPOLY',
      decimals: 6,
      logo: createSvgDataUri('P'),
    },
  ],
  [PORTFOLIO_SUPPORTED_CHAIN_IDS.arbitrum]: [
    {
      contractAddress: '0x0000000000000000000000000000000000005000',
      balance: '555000000000000000',
      name: 'Mock Arbitrum Token',
      symbol: 'mARB',
      decimals: 18,
      logo: createSvgDataUri('A'),
    },
  ],
  [PORTFOLIO_SUPPORTED_CHAIN_IDS.base]: [
    {
      contractAddress: '0x0000000000000000000000000000000000006000',
      balance: '2500000000',
      name: 'Mock Base USD',
      symbol: 'mBUSD',
      decimals: 6,
      logo: createSvgDataUri('B'),
    },
  ],
  [PORTFOLIO_SUPPORTED_CHAIN_IDS.optimism]: [
    {
      contractAddress: '0x0000000000000000000000000000000000007000',
      balance: '10000000000000000',
      name: 'Mock Optimism Token',
      symbol: 'mOP',
      decimals: 18,
      logo: createSvgDataUri('O'),
    },
  ],
};

type OwnedNftFixture = {
  tokenId: string;
  contractAddress: `0x${string}`;
  contractName: string;
  tokenType: 'ERC721' | 'ERC1155';
  name?: string;
  description?: string;
  image?: string;
  balance?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
};

const NFTS_BY_CHAIN: Record<number, OwnedNftFixture[]> = {
  [PORTFOLIO_SUPPORTED_CHAIN_IDS.mainnet]: [
    {
      tokenId: '11',
      contractAddress: '0x000000000000000000000000000000000000a011',
      contractName: 'Mock Keys',
      tokenType: 'ERC721',
      name: 'Mock Key #11',
      description: 'A mocked ERC-721 key asset for Storybook.',
      image: createSvgDataUri('K11', { bg: '#000000', fg: '#FC1819' }),
      attributes: [
        { trait_type: 'Rarity', value: 'Common' },
        { trait_type: 'Color', value: '#FC1819' },
      ],
    },
    {
      tokenId: '12',
      contractAddress: '0x000000000000000000000000000000000000a011',
      contractName: 'Mock Keys',
      tokenType: 'ERC721',
      name: 'Mock Key #12',
      image: createSvgDataUri('K12', { bg: '#0b1220', fg: '#93c5fd' }),
    },
    {
      tokenId: '2',
      contractAddress: '0x000000000000000000000000000000000000b115',
      contractName: 'Mock Items',
      tokenType: 'ERC1155',
      name: 'Mock Item #2',
      balance: '3',
      image: createSvgDataUri('I2', { bg: '#1f2937', fg: '#10b981' }),
    },
  ],
  [PORTFOLIO_SUPPORTED_CHAIN_IDS.sepolia]: [
    {
      tokenId: '1',
      contractAddress: '0x000000000000000000000000000000000000c721',
      contractName: 'Mock Sepolia NFTs',
      tokenType: 'ERC721',
      name: 'Sepolia NFT #1',
      image: createSvgDataUri('S1', { bg: '#111827', fg: '#FBBF24' }),
    },
  ],
  [PORTFOLIO_SUPPORTED_CHAIN_IDS.polygon]: [
    {
      tokenId: '7',
      contractAddress: '0x000000000000000000000000000000000000d721',
      contractName: 'Mock Polygon NFTs',
      tokenType: 'ERC721',
      name: 'Polygon NFT #7',
      image: createSvgDataUri('P7', { bg: '#4c1d95', fg: '#f5f3ff' }),
    },
  ],
  [PORTFOLIO_SUPPORTED_CHAIN_IDS.arbitrum]: [
    {
      tokenId: '42',
      contractAddress: '0x000000000000000000000000000000000000e721',
      contractName: 'Mock Arbitrum NFTs',
      tokenType: 'ERC721',
      name: 'Arbitrum NFT #42',
      image: createSvgDataUri('A42', { bg: '#0b1220', fg: '#60a5fa' }),
    },
  ],
  [PORTFOLIO_SUPPORTED_CHAIN_IDS.base]: [
    {
      tokenId: '5',
      contractAddress: '0x000000000000000000000000000000000000f721',
      contractName: 'Mock Base NFTs',
      tokenType: 'ERC721',
      name: 'Base NFT #5',
      image: createSvgDataUri('B5', { bg: '#001a4d', fg: '#a7f3d0' }),
    },
  ],
  [PORTFOLIO_SUPPORTED_CHAIN_IDS.optimism]: [
    {
      tokenId: '99',
      contractAddress: '0x0000000000000000000000000000000000000099',
      contractName: 'Mock OP NFTs',
      tokenType: 'ERC721',
      name: 'OP NFT #99',
      image: createSvgDataUri('O99', { bg: '#111', fg: '#fff' }),
    },
  ],
};

function chainIdFromAlchemyUrl(url: string): number | null {
  const map: Array<[RegExp, number]> = [
    [/eth-mainnet\.g\.alchemy\.com/i, PORTFOLIO_SUPPORTED_CHAIN_IDS.mainnet],
    [/eth-sepolia\.g\.alchemy\.com/i, PORTFOLIO_SUPPORTED_CHAIN_IDS.sepolia],
    [/polygon-mainnet\.g\.alchemy\.com/i, PORTFOLIO_SUPPORTED_CHAIN_IDS.polygon],
    [/arb-mainnet\.g\.alchemy\.com/i, PORTFOLIO_SUPPORTED_CHAIN_IDS.arbitrum],
    [/base-mainnet\.g\.alchemy\.com/i, PORTFOLIO_SUPPORTED_CHAIN_IDS.base],
    [/opt-mainnet\.g\.alchemy\.com/i, PORTFOLIO_SUPPORTED_CHAIN_IDS.optimism],
  ];
  for (const [re, chainId] of map) if (re.test(url)) return chainId;
  return null;
}

function jsonResponse(body: unknown, init?: { status?: number }) {
  const status = init?.status ?? 200;
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, init?: { status?: number }) {
  const status = init?.status ?? 500;
  return jsonResponse({ error: { message } }, { status });
}

export type PortfolioAlchemyMode = 'ok' | 'error';

export function createPortfolioAlchemyFetchHandlers(options?: { mode?: PortfolioAlchemyMode }) {
  const mode = options?.mode ?? 'ok';

  return [
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

      const chainId = chainIdFromAlchemyUrl(url);
      const isRpc = url.includes('.g.alchemy.com/v2/');
      const isNft = url.includes('.g.alchemy.com/nft/v3/');
      if (!chainId || (!isRpc && !isNft)) return undefined;

      if (mode === 'error') {
        return errorResponse('Mocked Alchemy error', { status: 500 });
      }

      if (isRpc) {
        const bodyText = typeof init?.body === 'string' ? init.body : undefined;
        const payload = bodyText ? (JSON.parse(bodyText) as { method?: string; params?: unknown[]; id?: number }) : {};
        const id = typeof payload.id === 'number' ? payload.id : 1;

        if (payload.method === 'alchemy_getTokenBalances') {
          const fixtures = ERC20_BY_CHAIN[chainId] ?? [];
          return jsonResponse({
            jsonrpc: '2.0',
            id,
            result: {
              tokenBalances: fixtures.map((t) => ({
                contractAddress: t.contractAddress,
                tokenBalance: t.balance,
              })),
            },
          });
        }

        if (payload.method === 'alchemy_getTokenMetadata') {
          const address = payload.params?.[0];
          const fixtures = ERC20_BY_CHAIN[chainId] ?? [];
          const match = fixtures.find((t) => t.contractAddress.toLowerCase() === String(address).toLowerCase());
          return jsonResponse({
            jsonrpc: '2.0',
            id,
            result: match
              ? {
                  name: match.name,
                  symbol: match.symbol,
                  decimals: match.decimals,
                  logo: match.logo,
                }
              : {
                  name: 'Unknown Token',
                  symbol: 'UNKNOWN',
                  decimals: 18,
                },
          });
        }

        return errorResponse(`Mock RPC method not implemented: ${payload.method ?? 'unknown'}`, { status: 501 });
      }

      // NFT API
      if (isNft) {
        const owned = NFTS_BY_CHAIN[chainId] ?? [];
        return jsonResponse({
          ownedNfts: owned.map((nft) => ({
            tokenId: nft.tokenId,
            contract: { address: nft.contractAddress, name: nft.contractName, tokenType: nft.tokenType },
            name: nft.name,
            description: nft.description,
            balance: nft.balance,
            image: { cachedUrl: nft.image },
            raw: { metadata: { attributes: nft.attributes ?? [] } },
          })),
          pageKey: null,
        });
      }

      return undefined;
    },
  ] as const;
}
