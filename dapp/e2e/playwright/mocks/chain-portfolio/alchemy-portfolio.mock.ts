// dapp/e2e/playwright/mocks/chain-portfolio/alchemy-portfolio.mock.ts
import type { Page, Request } from '@playwright/test';
import type {
  PortfolioDataset,
  PortfolioTokenType,
  ERC20Asset,
  ERC721Asset,
  ERC1155Asset,
} from './types';

function detectChainIdFromAlchemy(urlStr: string): number | null {
  try {
    const h = new URL(urlStr).hostname;
    if (h.includes('eth-mainnet')) return 1;
    if (h.includes('polygon-mainnet')) return 137;
    if (h.includes('eth-sepolia')) return 11155111;
    if (h.includes('arb-mainnet')) return 42161;
    if (h.includes('avax-mainnet')) return 43114;
    if (h.includes('base-mainnet')) return 8453;
    if (h.includes('opt-mainnet')) return 10;
    if (h.includes('fantom-mainnet')) return 250;
    return null;
  } catch {
    return null;
  }
}

function toHexFromDecimalString(s: string): string {
  try {
    const n = BigInt(s);
    return '0x' + n.toString(16);
  } catch {
    return '0x1';
  }
}

function normalizeErc20Balance(asset: ERC20Asset): string {
  const b = asset.balance ?? '0';
  if (b.startsWith('0x')) return b;
  return toHexFromDecimalString(b);
}

function nftToAlchemyShape(a: ERC721Asset | ERC1155Asset) {
  const tokenType: 'ERC721' | 'ERC1155' = a.type === 'ERC-721' ? 'ERC721' : 'ERC1155';
  const img =
    (a as any).image ||
    (a as any).logo ||
    undefined;
  const image = img
    ? { cachedUrl: img, originalUrl: img, pngUrl: img, thumbnailUrl: img }
    : undefined;

  const base = {
    contract: { address: a.contractAddress, tokenType },
    tokenId: a.tokenId,
    name: (a as any).name || undefined,
    image,
    media: image ? [{ gateway: img, thumbnail: img, raw: img }] : [],
    raw: { metadata: { image: img, name: (a as any).name } },
  } as any;

  if (tokenType === 'ERC1155') {
    base.balance = (a as ERC1155Asset).balance ?? '1';
  }

  return base;
}

async function parseJson(req: Request) {
  try {
    const raw = req.postData();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function installPortfolioAlchemyMock(page: Page, opts: {
  dataset: PortfolioDataset;
  debug?: boolean;
}) {
  const { dataset, debug = false } = opts;

  // JSON-RPC (ERC-20): alchemy_getTokenBalances / alchemy_getTokenMetadata
  await page.route('**/*alchemy.com*/v2/**', async (route, request) => {
    if (request.method() !== 'POST') return route.fallback();

    const chainId = detectChainIdFromAlchemy(request.url());
    if (!chainId || !dataset[chainId]) return route.fallback();

    const body = await parseJson(request);
    const method = body?.method as string;
    const id = body?.id ?? 1;

    if (debug) console.log(`[AlchemyMock][${chainId}] RPC ${method}`);

    if (method === 'alchemy_getTokenBalances') {
      const address = body?.params?.[0] ?? '0x0';
      const list = (dataset[chainId].erc20 || []).map((a) => ({
        contractAddress: a.contractAddress,
        tokenBalance: normalizeErc20Balance(a),
      }));

      return route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: { address, tokenBalances: list },
        }),
      });
    }

    if (method === 'alchemy_getTokenMetadata') {
      const addr = (body?.params?.[0] || '') as string;
      const match = (dataset[chainId].erc20 || []).find(
        (a) => a.contractAddress.toLowerCase() === String(addr).toLowerCase()
      );
      const result = match
        ? { name: match.name, symbol: match.symbol, decimals: match.decimals, logo: (match as any).logo }
        : { name: 'Unknown Token', symbol: 'UNKNOWN', decimals: 18 };

      return route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, result }),
      });
    }

    return route.fallback();
  });

  // NFT REST: /nft/v3/<key>/getNFTsForOwner
  await page.route('**/*alchemy.com*/nft/v3/**/getNFTsForOwner**', async (route, request) => {
    const chainId = detectChainIdFromAlchemy(request.url());
    if (!chainId || !dataset[chainId]) return route.fallback();

    const url = new URL(request.url());
    const owner = url.searchParams.get('owner') ?? '';
    const pageSize = Number(url.searchParams.get('pageSize') ?? '100');
    const pageKey = url.searchParams.get('pageKey');

    const all = [
      ...(dataset[chainId].erc721 || []),
      ...(dataset[chainId].erc1155 || []),
    ].map(nftToAlchemyShape);

    let start = 0;
    if (pageKey) {
      const n = Number(pageKey);
      if (Number.isFinite(n) && n > 0) start = n;
    }
    const end = Math.min(all.length, start + pageSize);
    const slice = all.slice(start, end);
    const next = end < all.length ? String(end) : undefined;

    if (debug) {
      console.log(`[AlchemyMock][${chainId}] NFTs owner=${owner} items=${slice.length}/${all.length} start=${start}`);
    }

    return route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownedNfts: slice,
        pageKey: next,
        totalCount: all.length,
      }),
    });
  });

  if (debug) console.log('[AlchemyMock] installed');
}
