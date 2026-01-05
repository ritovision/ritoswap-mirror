// dapp/e2e/playwright/mocks/chain-portfolio/chain-portfolio.mock.ts
import type { Page, Request } from '@playwright/test';
import type {
  PortfolioMockOptions,
  PortfolioTokenType,
  AnyAsset,
  PortfolioDataset,
} from './types';

function normType(t?: string): PortfolioTokenType | null {
  if (!t) return null;
  const s = t.toLowerCase().replace(/[_\s-]/g, '');
  if (s === 'erc20') return 'ERC-20';
  if (s === 'erc721') return 'ERC-721';
  if (s === 'erc1155') return 'ERC-1155';
  return null;
}

function pickAssets(
  dataset: PortfolioDataset,
  chainId: number,
  tokenType: PortfolioTokenType
): AnyAsset[] {
  const chain = dataset[chainId];
  if (!chain) return [];
  if (tokenType === 'ERC-20') return chain.erc20;
  if (tokenType === 'ERC-721') return chain.erc721;
  return chain.erc1155;
}

function parseQuery(url: string): URLSearchParams {
  try {
    return new URL(url).searchParams;
  } catch {
    return new URLSearchParams();
  }
}

async function parseBody(req: Request): Promise<any> {
  try {
    const raw = req.postData();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getReqParams(request: Request) {
  const url = request.url();
  const q = parseQuery(url);
  const body = (request.method() === 'POST') ? undefined : undefined; // body only if you want; leaving off for now
  const candType = q.get('tokenType') || q.get('type');
  const candChain = q.get('chainId') || q.get('chain') || q.get('network');
  const candAddr = q.get('address') || q.get('owner') || q.get('wallet');

  const tokenType = normType(candType ?? '');
  const chainId = candChain ? Number(candChain) : NaN;
  const address = candAddr ?? '';

  const page = q.get('page') ? Number(q.get('page')) : 1;
  const cursor = q.get('cursor') ?? null;

  return { tokenType, chainId, address, page, cursor, url };
}

function jsonHeaders() {
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  };
}

export async function installChainPortfolioMock(page: Page, opts: PortfolioMockOptions) {
  const {
    routes = [
      '**/api/portfolio/assets**',
      '**/api/wallet/assets**',
      '**/api/assets**',
    ],
    dataset,
    pageSize = 50,
    debug = false,
  } = opts;

  for (const pattern of routes) {
    await page.route(pattern, async (route, request) => {
      const { tokenType, chainId, address, page: pageNum, cursor, url } = getReqParams(request);

      // Only handle if tokenType + chainId are present; otherwise pass through.
      if (!tokenType || !Number.isFinite(chainId)) {
        if (debug) console.log(`[PortfolioMock] pass-through ${request.method()} ${url}`);
        return route.fallback();
      }

      const allAssets = pickAssets(dataset, chainId, tokenType);
      // simple paging: page (1-based) takes pageSize slices
      const start = Math.max(0, (pageNum - 1) * pageSize);
      const end = start + pageSize;
      const slice = allAssets.slice(start, end);

      const nextPage = end < allAssets.length ? pageNum + 1 : null;

      const body = {
        ok: true,
        chainId,
        address,
        tokenType,
        page: pageNum,
        nextPage,
        nextCursor: nextPage ? String(nextPage) : null,
        assets: slice,
        total: allAssets.length,
      };

      if (debug) {
        console.log(
          `[PortfolioMock] ✅ ${request.method()} ${url} → ${tokenType} on chain ${chainId} ` +
          `items=${slice.length}/${allAssets.length} page=${pageNum}`
        );
      }

      return route.fulfill({
        status: 200,
        headers: jsonHeaders(),
        body: JSON.stringify(body),
      });
    });
  }

  if (debug) {
    console.log(`[PortfolioMock] Installed for patterns:`, routes);
    const chains = Object.keys(dataset).join(', ');
    console.log(`[PortfolioMock] Chains available: ${chains || '(none)'}`);
  }
}
