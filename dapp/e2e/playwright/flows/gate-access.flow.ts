// dapp/e2e/playwright/flows/gate-access.flow.ts
import { Page, expect } from '@playwright/test';

/**
 * Robust unlock for token gate with retries.
 * - Clicks the "Sign message to unlock the token gate" button
 * - Waits for either the gated textarea to appear OR a successful /api/gate-access response
 * - On failure: attempts to cancel "processing" modal, optionally refreshes, then retries
 */
export async function unlockTokenGateWithRetry(
  page: Page,
  opts: {
    maxAttempts?: number;
    waitForResponseMs?: number;
    waitForUIVisibleMs?: number;
    refreshOnFail?: boolean;
    pauseBetweenAttemptsMs?: number;
  } = {}
) {
  const {
    maxAttempts = 3,
    waitForResponseMs = 15_000,
    waitForUIVisibleMs = 15_000,
    refreshOnFail = true,
    pauseBetweenAttemptsMs = 800,
  } = opts;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const label = `[Gate Unlock] Attempt ${attempt}/${maxAttempts}`;
    console.log(`${label} starting`);

    const unlockButton = page.getByRole('button', {
      name: 'Sign message to unlock the token gate',
    });

    await expect(unlockButton).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(500);
    await unlockButton.click();

    const uiSuccess = page
      .locator('#gatedTextarea')
      .waitFor({ state: 'visible', timeout: waitForUIVisibleMs })
      .then(() => true)
      .catch(() => false);

    const netSuccess = page
      .waitForResponse(
        (res) =>
          res.url().includes('/api/gate-access') &&
          res.status() >= 200 &&
          res.status() < 300,
        { timeout: waitForResponseMs }
      )
      .then(() => true)
      .catch(() => false);

    const succeeded = await Promise.race([uiSuccess, netSuccess]);

    if (succeeded) {
      await expect(page.locator('#gatedTextarea')).toBeVisible({ timeout: 5_000 });
      console.log(`${label} success`);
      return;
    }

    console.warn(`${label} failed, attempting recovery`);

    // Try to cancel any "processing" modal if present
    try {
      const dialog = page.getByRole('dialog');
      const cancelBtn = dialog.getByRole('button', { name: /cancel|close|dismiss/i }).first();
      if (await cancelBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await cancelBtn.click().catch(() => {});
        await page.waitForTimeout(300);
      }
    } catch {}

    if (refreshOnFail) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
    }

    await page.waitForTimeout(pauseBetweenAttemptsMs);
  }

  throw new Error('Failed to unlock token gate after all retry attempts');
}
