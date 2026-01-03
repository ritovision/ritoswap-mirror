// dapp/e2e/playwright/flows/music.flow.ts
import { Page, expect } from '@playwright/test';

export async function playSecretSong(page: Page) {
  await page.getByRole('tab', { name: /^Secret Song$/i }).click();

  const player = page.getByRole('region', { name: /^Audio player$/i });
  await expect(player).toBeVisible({ timeout: 10_000 });

  const playBtn = page.locator('button[aria-label="Play"]');
  await playBtn.waitFor({ state: 'visible', timeout: 8_000 });
  await page.waitForTimeout(1200);
  await playBtn.click();

  // Be robust: accept any of these post-click states
  const becamePauseLabel = page.locator('button[aria-label="Pause"]');
  const becamePressed = page.locator('button[aria-pressed="true"]');
  const statusLive = player.locator('[role="status"]');

  const anySuccess = async () => {
    if (await becamePauseLabel.isVisible().catch(() => false)) return true;
    if (await becamePressed.isVisible().catch(() => false)) return true;
    const statusText = (await statusLive.first().textContent().catch(() => '')) || '';
    if (/playing|pause|00:\d{2}/i.test(statusText)) return true;
    return false;
  };

  const startedAt = Date.now();
  while (Date.now() - startedAt < 7000) {
    if (await anySuccess()) return;
    await page.waitForTimeout(200);
  }

  // Last-chance assertion to surface a good error
  await expect(
    becamePauseLabel.or(becamePressed).or(statusLive.filter({ hasText: /playing|pause/i }))
  ).toBeVisible({ timeout: 1000 });
}
