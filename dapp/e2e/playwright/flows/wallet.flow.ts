import { Page, expect } from '@playwright/test';
import { WalletTestUtils } from '../utils/wallet.utils';

export async function isMobileWidth(page: Page, breakpoint = 730) {
  const vp = page.viewportSize();
  if (vp?.width != null) return vp.width <= breakpoint;
  const innerWidth = await page.evaluate(() => window.innerWidth);
  return innerWidth <= breakpoint;
}

export async function ensureConnected(page: Page, walletName?: string) {
  const w = new WalletTestUtils(page);
  if (await w.isWalletConnected()) {
    await w.assertWalletConnected();
    return;
  }
  await w.connectWallet(walletName);
  await w.assertWalletConnected();
}

export async function ensureDisconnected(page: Page) {
  const w = new WalletTestUtils(page);
  if (await w.isWalletConnected()) {
    await w.disconnectWallet();
  } else {
    await w.assertWalletDisconnected();
  }
}

export async function previewWalletConnectQr(page: Page, opts?: { waitForQrMs?: number; lingerMs?: number }) {
  if (await isMobileWidth(page, 730)) {
    return;
  }
  const w = new WalletTestUtils(page);
  await w.openConnectModal();
  await w.clickWalletConnectOption();
  await w.waitForQrVisible(opts?.waitForQrMs ?? 15_000);
  await page.waitForTimeout(opts?.lingerMs ?? 1_000);
  await w.pressModalBack();
  await w.waitForDefaultWalletList();
}

export async function previewQrThenConnect(page: Page, walletName?: string) {
  await previewWalletConnectQr(page);
  const w = new WalletTestUtils(page);
  if (await w.isModalOpen()) {
    await w.connectFromOpenModal(walletName);
  } else {
    await ensureConnected(page, walletName);
  }
}

export async function reconnectAfterReload(page: Page, walletName?: string) {
  await ensureConnected(page, walletName);
  await page.reload({ waitUntil: 'networkidle' });
  const w = new WalletTestUtils(page);
  await w.assertWalletConnected();
}

export async function cancelConnectViaEsc(page: Page) {
  const w = new WalletTestUtils(page);
  await w.openConnectModal();
  await page.keyboard.press('Escape');
  const backdrop = page.locator('[class*="ConnectModal_backdrop"], [class*="ModalWrapper_backdrop"]');
  const dialog = page.getByRole('dialog');
  if (await backdrop.count()) {
    await expect(backdrop).not.toBeVisible({ timeout: 10_000 });
  } else {
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  }
  await w.assertWalletDisconnected();
}
