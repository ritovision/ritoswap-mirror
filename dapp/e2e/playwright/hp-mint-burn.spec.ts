import { test, expect } from '@playwright/test';
import { setupTest } from './wallet';
import { e2eEnv, logE2eEnvOnce } from './env';
import { ensureConnected } from './flows/wallet.flow';
import { burnIfKeyPresent } from './flows/nft.flow';

const WALLET_NAME = 'Test Wallet';

test.describe('Mint and Burn NFT (REAL Sepolia tx)', () => {
  test('should mint and burn an NFT successfully', async ({ page }) => {
    test.setTimeout(120000);
    logE2eEnvOnce();

    const setup = await setupTest(page, {
      clearStorage: true,
      injectWallet: true,
      walletConfig: {
        address: e2eEnv.address,
        privateKey: e2eEnv.privateKey,
        chainId: e2eEnv.chainId,
        walletName: WALLET_NAME,
      },
    });

    await page.goto('/mint', { waitUntil: 'networkidle' });
    await setup.waitForWagmi();

    await ensureConnected(page, WALLET_NAME);

    // 🔐 Safety: if an NFT is already present, burn it before proceeding
    await burnIfKeyPresent(page);

    const mintButton = page.getByRole('button', { name: /^Mint NFT$/i });
    await expect(mintButton).toBeVisible({ timeout: 10_000 });

    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[Test Wallet]') || text.includes('[BRIDGE]')) {
        console.log('Wallet log:', text);
      }
    });

    await mintButton.click();

    const processingModal = page.getByTestId('processing-modal-overlay');
    if (await processingModal.isVisible().catch(() => false)) {}

    const burnButton = page.getByRole('button', { name: /^Burn NFT$/i });
    await expect(burnButton).toBeVisible({ timeout: 60_000 });

    await burnButton.click();

    await expect(mintButton).toBeVisible({ timeout: 60_000 });

    const finalText = await page.locator('text="YOU DON\'T HAVE A KEY YET"').isVisible().catch(() => false);
    if (finalText) {
      console.log('✅ Confirmed: Back to initial state');
    }
  });
});
