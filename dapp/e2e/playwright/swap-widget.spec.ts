// dapp/e2e/playwright/swap-widget.spec.ts
import { test, expect, Page, Locator } from '@playwright/test';
import { setupTest } from './wallet';
import { walletConfigFromEnv, logE2eEnvOnce } from './env';
import { WalletTestUtils } from './utils/wallet.utils';

const TEST_WALLET_CONFIG = walletConfigFromEnv;

function widgetLocators(page: Page): {
  container: Locator;
  content: Locator;
  connectBtn: Locator;
  exchangeBtn: Locator;
  modalBackdrop: Locator;
  dialog: Locator;
  caption: Locator;
} {
  const container = page.locator('[class*="widgetContainer"]'); // CSS module class substring
  const content = page.locator('[class*="widgetContent"]');     // fades in
  const within = container;
  const connectBtn = within.getByRole('button', { name: /^Connect wallet$/i });
  const exchangeBtn = within.getByRole('button', { name: /^Exchange$/i });
  const modalBackdrop = page.locator('[class*="ConnectModal_backdrop"], [class*="ModalWrapper_backdrop"]');
  const dialog = page.getByRole('dialog');
  const caption = page.locator('[class*="caption"]');

  return { container, content, connectBtn, exchangeBtn, modalBackdrop, dialog, caption };
}

async function waitForWidgetReady(page: Page): Promise<void> {
  const { container, content, connectBtn, exchangeBtn } = widgetLocators(page);

  await expect(container, 'widget container should be in the DOM').toBeVisible({ timeout: 30_000 });

  const start = Date.now();
  while (Date.now() - start < 30_000) {
    if (await connectBtn.isVisible().catch(() => false)) break;
    if (await exchangeBtn.isVisible().catch(() => false)) break;
    await page.waitForTimeout(200);
  }

  const connectVisible = await connectBtn.isVisible().catch(() => false);
  const exchangeVisible = await exchangeBtn.isVisible().catch(() => false);
  expect(
    connectVisible || exchangeVisible,
    'widget should render Connect wallet or Exchange button',
  ).toBeTruthy();

  // Don’t blow up if the fade didn’t toggle yet; we just try to wait.
  await content.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
}

test.describe('Swap Widget ↔ Site Wallet Sync', () => {
  test('renders and stays in sync with native site wallet (both directions + reload)', async ({ page }) => {
    logE2eEnvOnce();

    const setup = await setupTest(page, {
      clearStorage: true,
      injectWallet: true,
      walletConfig: TEST_WALLET_CONFIG,
      persistConnection: true,
    });

    const wallet = new WalletTestUtils(page);

    await test.step('Navigate to /swap and wait for widget ready', async () => {
      await page.goto('/swap', { waitUntil: 'networkidle' });
      await setup.waitForWagmi();
      await waitForWidgetReady(page);
    });

    const { connectBtn, exchangeBtn, dialog, modalBackdrop, caption } = widgetLocators(page);

    await test.step('Initial state: disconnected (widget shows Connect wallet)', async () => {
      if (await wallet.isWalletConnected()) {
        await wallet.disconnectWallet();
      }
      await expect(connectBtn).toBeVisible({ timeout: 15_000 });
      await wallet.assertWalletDisconnected();
    });

    await test.step('Widget → Native: click widget Connect, use same modal, connect; site becomes connected', async () => {
      await connectBtn.click();

      const modalVisible =
        (await dialog.isVisible().catch(() => false)) ||
        (await modalBackdrop.isVisible().catch(() => false));
      expect(modalVisible, 'connect modal should open from widget button').toBeTruthy();

      await wallet.connectFromOpenModal(TEST_WALLET_CONFIG.walletName);

      await wallet.assertWalletConnected();
      await expect(exchangeBtn).toBeVisible({ timeout: 15_000 });
      await expect(caption).toContainText(/Connected:\s*0x/i, { timeout: 10_000 });
    });

    await test.step('Native disconnect: site disconnect button logs out; widget returns to Connect wallet', async () => {
      await wallet.disconnectWallet();
      await wallet.assertWalletDisconnected();
      await expect(connectBtn).toBeVisible({ timeout: 15_000 });
      await expect(exchangeBtn).toHaveCount(0);
    });

    await test.step('Native → Widget: connect via native button; widget switches to Exchange', async () => {
      await wallet.connectWallet(TEST_WALLET_CONFIG.walletName);
      await wallet.assertWalletConnected();
      await expect(exchangeBtn).toBeVisible({ timeout: 15_000 });
    });

    await test.step('Reload while signed in: both site and widget remain connected', async () => {
      await page.reload({ waitUntil: 'networkidle' });
      await setup.waitForWagmi();
      await wallet.assertWalletConnected();
      await waitForWidgetReady(page);
      await expect(exchangeBtn).toBeVisible({ timeout: 15_000 });
    });
  });
});
