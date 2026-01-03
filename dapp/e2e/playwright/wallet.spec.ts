import { test } from '@playwright/test';
import { setupTest } from './wallet';
import { walletConfigFromEnv, logE2eEnvOnce } from './env';
import { ensureConnected, reconnectAfterReload, cancelConnectViaEsc, ensureDisconnected, previewWalletConnectQr, isMobileWidth, previewQrThenConnect } from './flows/wallet.flow';
import { WalletTestUtils } from './utils/index';

const TEST_WALLET_CONFIG = walletConfigFromEnv;

test.describe('Wallet Connection', () => {
  test('should connect wallet successfully', async ({ page }) => {
    logE2eEnvOnce();

    const setup = await setupTest(page, {
      clearStorage: true,
      injectWallet: true,
      walletConfig: TEST_WALLET_CONFIG,
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    await setup.waitForWagmi();

    await ensureConnected(page, TEST_WALLET_CONFIG.walletName);

    const utils = new WalletTestUtils(page);
    await utils.assertWalletConnected();
  });

  test('should persist connection on page reload', async ({ page }) => {
    logE2eEnvOnce();

    const setup = await setupTest(page, {
      clearStorage: true,
      injectWallet: true,
      walletConfig: TEST_WALLET_CONFIG,
      persistConnection: true,
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    await setup.waitForWagmi();

    await reconnectAfterReload(page, TEST_WALLET_CONFIG.walletName);
  });

  test('should handle modal cancellation', async ({ page }) => {
    logE2eEnvOnce();

    const setup = await setupTest(page, {
      clearStorage: true,
      injectWallet: true,
      walletConfig: TEST_WALLET_CONFIG,
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    await setup.waitForWagmi();

    await cancelConnectViaEsc(page);
  });

  test('should handle wallet disconnection', async ({ page }) => {
    logE2eEnvOnce();

    const setup = await setupTest(page, {
      clearStorage: true,
      injectWallet: true,
      walletConfig: TEST_WALLET_CONFIG,
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    await setup.waitForWagmi();

    await ensureConnected(page, TEST_WALLET_CONFIG.walletName);
    await ensureDisconnected(page);
  });

  test('should show WalletConnect QR, go back, then connect injected wallet', async ({ page }) => {
    logE2eEnvOnce();

    const setup = await setupTest(page, {
      clearStorage: true,
      injectWallet: true,
      walletConfig: TEST_WALLET_CONFIG,
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    await setup.waitForWagmi();

    const mobile = await isMobileWidth(page, 730);
    test.skip(mobile, 'WalletConnect QR is not shown on mobile (≤730px).');

    await previewQrThenConnect(page, TEST_WALLET_CONFIG.walletName);
  });
});
