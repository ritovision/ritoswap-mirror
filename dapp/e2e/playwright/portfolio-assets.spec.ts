import { test, expect } from '@playwright/test';
import { setupTest } from './wallet';
import { e2eEnv, logE2eEnvOnce } from './env';
import {
  installPortfolioAlchemyMock,
  type PortfolioDataset,
} from './mocks';
import {
  gotoPortfolio,
  selectNetworks,
  selectTokenTypes,
  ensureChainRegionOpen,
  expandTokenSection,
  expectGridRows,
  expectNoAssets,
  expectNativeBalanceRegion,
} from './flows/portfolio.flow';
import { ensureConnected } from './flows/wallet.flow';

test.describe('Portfolio page: per-chain assets (ERC-20/721/1155) w/ one empty chain', () => {
  const WALLET_NAME = 'Test Wallet';

  const dataset: PortfolioDataset = {
    1: {
      erc20: [
        {
          type: 'ERC-20',
          contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          balance: '25000000',
        },
        {
          type: 'ERC-20',
          contractAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
          symbol: 'DAI',
          name: 'Dai Stablecoin',
          decimals: 18,
          balance: '123000000000000000000',
        },
      ],
      erc721: [
        {
          type: 'ERC-721',
          contractAddress: '0xabcDEFabcDEFabcDEFabcDEFabcDEFabcDEF1234',
          tokenId: '1',
          name: 'Test NFT #1',
          image: 'https://picsum.photos/seed/erc721-1/300/300',
        },
        {
          type: 'ERC-721',
          contractAddress: '0xabcDEFabcDEFabcDEFabcDEFabcDEFabcDEF1234',
          tokenId: '2',
          name: 'Test NFT #2',
          image: 'https://picsum.photos/seed/erc721-2/300/300',
        },
      ],
      erc1155: [
        {
          type: 'ERC-1155',
          contractAddress: '0xDeaDDeaDDeaDDeaDDeaDDeaDDeaDDeaDDeaD0001',
          tokenId: '42',
          balance: '7',
          name: 'Bundle #42',
          image: 'https://picsum.photos/seed/erc1155-42/300/300',
        },
        {
          type: 'ERC-1155',
          contractAddress: '0xDeaDDeaDDeaDDeaDDeaDDeaDDeaDDeaDDeaD0001',
          tokenId: '43',
          balance: '1',
          name: 'Bundle #43',
          image: 'https://picsum.photos/seed/erc1155-43/300/300',
        },
      ],
    },
    137: { erc20: [], erc721: [], erc1155: [] },
  };

  test('shows assets on Ethereum and empty state on Polygon', async ({ page }) => {
    test.setTimeout(180_000);
    logE2eEnvOnce();

    await setupTest(page, {
      clearStorage: true,
      injectWallet: true,
      persistConnection: true,
      walletConfig: {
        address: e2eEnv.address,
        privateKey: e2eEnv.privateKey,
        chainId: e2eEnv.chainId,
        walletName: WALLET_NAME,
      },
    });

    await installPortfolioAlchemyMock(page, { dataset, debug: true });

    await gotoPortfolio(page);
    await ensureConnected(page, WALLET_NAME);

    await selectNetworks(page, ['Ethereum', 'Polygon']);
    await selectTokenTypes(page, ['ERC-20', 'ERC-721', 'ERC-1155']);

    const ethRegion = await ensureChainRegionOpen(page, 'Ethereum');
    await expectNativeBalanceRegion(ethRegion, 'Ethereum');

    await expandTokenSection(ethRegion, 'ERC-20');
    await expectGridRows(ethRegion, 'ERC-20', 1);

    await expandTokenSection(ethRegion, 'ERC-721');
    await expectGridRows(ethRegion, 'ERC-721', 1);

    await expandTokenSection(ethRegion, 'ERC-1155');
    await expectGridRows(ethRegion, 'ERC-1155', 1);

    const polygonRegion = await ensureChainRegionOpen(page, 'Polygon');
    await expectNativeBalanceRegion(polygonRegion, 'Polygon');

    await expandTokenSection(polygonRegion, 'ERC-20');
    await expectNoAssets(polygonRegion, 'ERC-20');

    await expandTokenSection(polygonRegion, 'ERC-721');
    await expectNoAssets(polygonRegion, 'ERC-721');

    await expandTokenSection(polygonRegion, 'ERC-1155');
    await expectNoAssets(polygonRegion, 'ERC-1155');

    await expect(page.getByRole('region', { name: /Selected chains/i })).toBeVisible();
  });
});
