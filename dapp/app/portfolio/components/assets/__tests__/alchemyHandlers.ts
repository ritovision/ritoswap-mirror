import { http, HttpResponse } from 'msw';

const ALCHEMY_API_KEY = 'test-api-key';

// Mock data
const mockERC20Tokens = {
  USDC: {
    contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    logo: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
  },
  USDT: {
    contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 6,
    logo: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
  },
};

const mockNFTCollections = {
  BAYC: {
    address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
    name: 'Bored Ape Yacht Club',
    tokenType: 'ERC721',
  },
  Azuki: {
    address: '0xED5AF388653567Af2F388E6224dC7C4b3241C544',
    name: 'Azuki',
    tokenType: 'ERC721',
  },
};

export const alchemyHandlers = [
  // ERC-20 Token Balances
  http.post('https://*/v2/*', async ({ request }) => {
    const body = await request.json() as any;
    
    if (body.method === 'alchemy_getTokenBalances') {
      return HttpResponse.json({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          tokenBalances: [
            {
              contractAddress: mockERC20Tokens.USDC.contractAddress,
              tokenBalance: '0x0000000000000000000000000000000000000000000000000000000005f5e100', // 100 USDC
            },
            {
              contractAddress: mockERC20Tokens.USDT.contractAddress,
              tokenBalance: '0x0', // 0 USDT
            },
          ],
        },
      });
    }

    if (body.method === 'alchemy_getTokenMetadata') {
      const tokenAddress = body.params[0];
      const token = Object.values(mockERC20Tokens).find(
        t => t.contractAddress.toLowerCase() === tokenAddress.toLowerCase()
      );

      if (token) {
        return HttpResponse.json({
          jsonrpc: '2.0',
          id: body.id,
          result: token,
        });
      }

      return HttpResponse.json({
        jsonrpc: '2.0',
        id: body.id,
        error: { code: -32602, message: 'Token not found' },
      });
    }

    return HttpResponse.json({
      jsonrpc: '2.0',
      id: body.id,
      error: { code: -32601, message: 'Method not found' },
    });
  }),

  // NFT API
  http.get('https://*/nft/v3/*/getNFTsForOwner', ({ request }) => {
    const url = new URL(request.url);
    const pageKey = url.searchParams.get('pageKey');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '100');

    if (pageKey === 'page2') {
      // Second page
      const nfts = Array(50).fill(null).map((_, i) => ({
        tokenId: String(pageSize + i),
        contract: mockNFTCollections.BAYC,
        name: `Bored Ape #${pageSize + i}`,
        description: 'A bored ape NFT',
        image: {
          cachedUrl: `https://example.com/ape${pageSize + i}.png`,
          originalUrl: `https://example.com/ape${pageSize + i}.png`,
        },
        balance: '1',
      }));

      return HttpResponse.json({
        ownedNfts: nfts,
        pageKey: null, // No more pages
      });
    }

    // First page
    const nfts = Array(pageSize).fill(null).map((_, i) => ({
      tokenId: String(i),
      contract: mockNFTCollections.BAYC,
      name: `Bored Ape #${i}`,
      description: 'A bored ape NFT',
      image: {
        cachedUrl: `https://example.com/ape${i}.png`,
        originalUrl: i % 3 === 0 ? `ipfs://QmXxx${i}` : `https://example.com/ape${i}.png`,
      },
      balance: '1',
      raw: {
        metadata: {
          attributes: [
            { trait_type: 'Background', value: 'Blue' },
            { trait_type: 'Fur', value: 'Golden Brown' },
          ],
        },
      },
    }));

    return HttpResponse.json({
      ownedNfts: nfts,
      pageKey: pageSize === 100 ? 'page2' : null,
    });
  }),

  // Error handlers for testing error cases
  http.post('https://*/v2/*/error', () => {
    return HttpResponse.error();
  }),

  http.get('https://*/nft/v3/*/error', () => {
    return HttpResponse.error();
  }),
];