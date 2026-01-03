// dapp/e2e/playwright/flows/nft.flow.ts
import { Page, expect } from '@playwright/test';
import { NFTUtils } from '../utils/nft.utils';

export async function mintKey(page: Page) {
  const mintButton = page.getByRole('button', { name: /^Mint NFT$/i });
  await expect(mintButton).toBeVisible({ timeout: 10_000 });
  await mintButton.click();
  await expect(page.getByRole('button', { name: /^(Burn NFT|Burning NFT, processing)$/i }))
    .toBeVisible({ timeout: 60_000 });
}

export async function burnKey(page: Page) {
  // Accept both idle & busy accessible names
  const burnButton = page.getByRole('button', { name: /^(Burn NFT|Burning NFT, processing)$/i });
  await expect(burnButton).toBeVisible({ timeout: 60_000 });
  await burnButton.click();
  await expect(page.getByRole('button', { name: /^(Mint NFT|Minting NFT, processing)$/i }))
    .toBeVisible({ timeout: 90_000 });
}

/**
 * Waits until the mint UI is hydrated/settled enough that we can reliably
 * detect either Mint or Burn being available.
 */
async function waitForMintUiToSettle(page: Page, timeoutMs = 15_000) {
  // 1) If the "Loading..." placeholder is present, wait for it to go away.
  const loadingBtn = page.getByRole('button', { name: /Loading NFT actions/i });
  if (await loadingBtn.isVisible().catch(() => false)) {
    await expect(loadingBtn).not.toBeVisible({ timeout: 10_000 });
  }

  // 2) The component intentionally animates between states (≈300ms + 50ms).
  // Give it a small grace window.
  await page.waitForTimeout(400);

  // 3) Poll until we see either Mint or Burn available.
  const burn = page.getByRole('button', { name: /^(Burn NFT|Burning NFT, processing)$/i });
  const mint = page.getByRole('button', { name: /^(Mint NFT|Minting NFT, processing)$/i });

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await burn.isVisible().catch(() => false)) return 'burn';
    if (await mint.isVisible().catch(() => false)) return 'mint';
    await page.waitForTimeout(100);
  }
  return 'unknown';
}

/**
 * Safety fallback: if a key already exists, burn it first so mint flows can proceed.
 * Assumes you're already on /mint and connected.
 */
export async function burnIfKeyPresent(page: Page, opts?: { log?: boolean }) {
  const log = opts?.log ?? true;
  const utils = new NFTUtils(page);

  // Helpful diagnostics before/after we wait for the UI to settle
  if (log) console.log('[E2E] Checking for pre-existing NFT (pre-settle)…');
  await utils.debugState();

  const state = await waitForMintUiToSettle(page, 15_000);
  if (log) console.log(`[E2E] UI settle result: ${state}`);

  // Now do a robust burn-detect (handles busy/idle aria-labels)
  const shouldBurn = await utils.canBurn();

  if (shouldBurn) {
    if (log) console.log('[E2E] Pre-existing NFT detected. Burning before test…');
    await burnKey(page);
    // Allow UI repaint/network settle
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: /^(Mint NFT|Minting NFT, processing)$/i }))
      .toBeVisible({ timeout: 90_000 });
    if (log) console.log('[E2E] Pre-existing NFT burned. Proceeding.');
  } else {
    if (log) {
      console.log('[E2E] No Burn button visible after settle. Treating as no pre-existing NFT.');
      await utils.debugState();
    }
  }
}
