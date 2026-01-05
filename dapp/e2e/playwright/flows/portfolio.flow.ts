// dapp/e2e/playwright/flows/portfolio.flow.ts
import { Page, Locator, expect } from '@playwright/test';

export async function gotoPortfolio(page: Page) {
  await page.goto('/portfolio', { waitUntil: 'domcontentloaded' });
}

export async function connectWalletIfNeeded(page: Page, walletName?: string) {
  const { WalletTestUtils } = await import('../utils');
  const wallet = new WalletTestUtils(page);
  if (!(await wallet.isWalletConnected())) {
    await wallet.connectWallet(walletName);
  } else {
    await wallet.assertWalletConnected();
  }
}

export async function selectNetworks(page: Page, names: string[]) {
  const group = page.getByRole('group', { name: /Select Network/i });
  await expect(group).toBeVisible();

  for (const name of names) {
    const item = group.getByRole('checkbox', { name: new RegExp(name, 'i') });
    await item.click();
    await expect(item).toHaveAttribute('aria-checked', /true/i);
  }
}

export async function selectTokenTypes(page: Page, types: string[]) {
  const group = page.getByRole('group', { name: /Select Tokens/i });
  await expect(group).toBeVisible();

  for (const type of types) {
    const item = group.getByRole('checkbox', { name: new RegExp(type, 'i') });
    await item.click();
    await expect(item).toHaveAttribute('aria-checked', /true/i);
  }
}

export async function ensureChainRegionOpen(page: Page, chainName: string): Promise<Locator> {
  const region = page.getByRole('region', { name: new RegExp(`Assets on\\s+${chainName}`, 'i') });
  await region.scrollIntoViewIfNeeded();
  await expect(region).toBeVisible({ timeout: 10_000 });

  const nativeBalance = () =>
    region.getByRole('region', { name: new RegExp(`Native balance for\\s+${chainName}`, 'i') });

  for (let i = 0; i < 4; i++) {
    if (await nativeBalance().isVisible().catch(() => false)) break;

    const triggerBtn = region.getByRole('button', { name: new RegExp(`^${chainName}$`, 'i') }).first();
    if (await triggerBtn.isVisible().catch(() => false)) {
      await triggerBtn.scrollIntoViewIfNeeded();
      await triggerBtn.click();
      await page.waitForTimeout(150);
      continue;
    }

    const title = region.getByText(new RegExp(`^${chainName}$`, 'i')).first();
    if (await title.isVisible().catch(() => false)) {
      await title.scrollIntoViewIfNeeded();
      await title.click();
      await page.waitForTimeout(150);
    }
  }

  await nativeBalance().scrollIntoViewIfNeeded();
  await expect(nativeBalance()).toBeVisible({ timeout: 30_000 });
  await region.scrollIntoViewIfNeeded();
  return region;
}

async function waitTokenSectionSettled(
  page: Page,
  chainRegion: Locator,
  tokenType: string,
  timeoutMs = 35000
) {
  const grid = chainRegion.getByRole('grid', { name: new RegExp(`${tokenType}\\s+assets\\s+grid`, 'i') });
  const statusNodes = chainRegion.getByRole('status');
  const loading = statusNodes.filter({ hasText: /Loading assets/i });
  const emptyByRole = statusNodes.filter({ hasText: /No Assets Found!/i });
  const emptyByText = chainRegion.getByText(/No Assets Found!/i).first();

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await grid.isVisible().catch(() => false)) {
      await grid.scrollIntoViewIfNeeded();
      return 'grid';
    }
    if (await emptyByRole.isVisible().catch(() => false)) {
      await emptyByRole.scrollIntoViewIfNeeded();
      return 'empty';
    }
    if (await emptyByText.isVisible().catch(() => false)) {
      await emptyByText.scrollIntoViewIfNeeded();
      return 'empty';
    }
    if (await loading.isVisible().catch(() => false)) {
      await loading.scrollIntoViewIfNeeded();
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out waiting for token section "${tokenType}" to settle`);
}

export async function expandTokenSection(chainRegion: Locator, tokenType: string) {
  const trigger = chainRegion.getByRole('button', { name: new RegExp(tokenType, 'i') });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.hover({ trial: true }).catch(() => {});
  await trigger.click();

  // if one click didn’t mount content (Radix state race), click once more
  const page = chainRegion.page();
  const maybeGrid = chainRegion.getByRole('grid', { name: new RegExp(`${tokenType}\\s+assets\\s+grid`, 'i') });
  const maybeEmpty = chainRegion.getByText(/No Assets Found!/i).first();
  const maybeLoading = chainRegion.getByRole('status', { name: /Loading assets/i });

  const appeared = await Promise.race([
    maybeGrid.waitFor({ state: 'visible', timeout: 800 }).then(() => true).catch(() => false),
    maybeEmpty.waitFor({ state: 'visible', timeout: 800 }).then(() => true).catch(() => false),
    maybeLoading.waitFor({ state: 'visible', timeout: 800 }).then(() => true).catch(() => false),
    page.waitForTimeout(800).then(() => false),
  ]);

  if (!appeared) {
    await trigger.click();
  }
}

export async function expectGridRows(chainRegion: Locator, tokenType: string, minRows: number = 1) {
  const page = chainRegion.page();
  await waitTokenSectionSettled(page, chainRegion, tokenType, 35000);
  const grid = chainRegion.getByRole('grid', { name: new RegExp(`${tokenType}\\s+assets\\s+grid`, 'i') });
  await grid.scrollIntoViewIfNeeded();
  await expect(grid).toBeVisible();
  const rows = grid.getByRole('row');
  const count = await rows.count();
  expect(count).toBeGreaterThanOrEqual(minRows);
}

export async function expectNoAssets(chainRegion: Locator, tokenType: string) {
  const page = chainRegion.page();
  await waitTokenSectionSettled(page, chainRegion, tokenType, 35000);
  const emptyRole = chainRegion.getByRole('status').filter({ hasText: /No Assets Found!/i }).first();
  const emptyText = chainRegion.getByText(/No Assets Found!/i).first();
  if (await emptyRole.isVisible().catch(() => false)) {
    await emptyRole.scrollIntoViewIfNeeded();
    await expect(emptyRole).toBeVisible();
  } else {
    await emptyText.scrollIntoViewIfNeeded();
    await expect(emptyText).toBeVisible();
  }
}

export async function expectNativeBalanceRegion(chainRegion: Locator, chainName?: string) {
  const bal = chainName
    ? chainRegion.getByRole('region', { name: new RegExp(`Native balance for\\s+${chainName}`, 'i') })
    : chainRegion.getByRole('region', { name: /Native balance/i });
  await bal.scrollIntoViewIfNeeded();
  await expect(bal).toBeVisible({ timeout: 30_000 });
}
