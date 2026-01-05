// e2e/smoke.spec.ts
import { test, expect } from '@playwright/test';

const routes = ['/', '/mint', '/portfolio', '/terms', '/privacy', '/gate', '/swap'];

test.describe.parallel('Public pages render', () => {
  for (const path of routes) {
    test(`✔ ${path}`, async ({ page }) => {
      // ─── 1) Navigate (wait until network is idle) ───────────────────────────────
      const res = await page.goto(path, { waitUntil: 'networkidle' });
      expect(res?.ok()).toBeTruthy();

      // (Optional) double-check that no stray network activity remains
      await page.waitForLoadState('networkidle');

      // ─── 2) Header ─────────────────────────────────────────────────────────────
      await expect(page.getByTestId('header')).toBeVisible();

      // ─── 3) Wallet bar exists (mobile-only, may be hidden on desktop) ─────────
      const walletBar = page.getByTestId('wallet-bar');
      await expect(walletBar).toHaveCount(1);

      // ─── 4) <title> sanity ────────────────────────────────────────────────────
      await expect(page).toHaveTitle(/RitoSwap/i);

      // ─── 5) canonical link present ─────────────────────────────────────────────
      const canonicalHref = await page
        .locator('head link[rel="canonical"]')
        .getAttribute('href');
      expect(canonicalHref).not.toBeNull();
      expect(canonicalHref!.length).toBeGreaterThan(5);

      // ─── 6) JSON-LD scripts exist (count ≥ 1) ──────────────────────────────────
      const jsonLdCount = await page
        .locator('script[type="application/ld+json"]')
        .count();
      expect(jsonLdCount).toBeGreaterThan(0);

      // ─── 7) No uncaught console errors ────────────────────────────────────────
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));
      expect(errors).toEqual([]);
    });
  }
});
