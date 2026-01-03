// dapp/e2e/playwright/utils/nft.utils.ts
import { Page, expect } from '@playwright/test';

/**
 * Simplified NFT interaction utilities
 */
export class NFTUtils {
  constructor(private page: Page) {}

  /**
   * Simple check: does burn button exist?
   * Accepts both idle and "processing" accessible names.
   */
  async canBurn(): Promise<boolean> {
    const burnIdle = this.page.getByRole('button', { name: /^Burn NFT$/i });
    const burnBusy = this.page.getByRole('button', { name: /^Burning NFT, processing$/i });
    const visibleIdle = await burnIdle.isVisible().catch(() => false);
    if (visibleIdle) return true;
    const visibleBusy = await burnBusy.isVisible().catch(() => false);
    return visibleBusy;
  }

  /**
   * Simple check: does mint button exist?
   * Accepts both idle and "processing" accessible names.
   */
  async canMint(): Promise<boolean> {
    const mintIdle = this.page.getByRole('button', { name: /^Mint NFT$/i });
    const mintBusy = this.page.getByRole('button', { name: /^Minting NFT, processing$/i });
    const visibleIdle = await mintIdle.isVisible().catch(() => false);
    if (visibleIdle) return true;
    const visibleBusy = await mintBusy.isVisible().catch(() => false);
    return visibleBusy;
  }

  /**
   * Gets the displayed token ID if visible
   */
  async getTokenId(): Promise<string | null> {
    // Just look for "Key #123" pattern
    const tokenText = this.page.locator('text=/Key #\\d+/');
    if (await tokenText.isVisible().catch(() => false)) {
      const text = await tokenText.textContent();
      if (text) {
        const match = text.match(/#(\d+)/);
        return match ? match[1] : null;
      }
    }
    return null;
  }

  /**
   * Debug helper - logs what's visible
   */
  async debugState() {
    // Probe multiple signals so logs are useful
    const state = {
      burnIdleVisible: await this.page.getByRole('button', { name: /^Burn NFT$/i }).isVisible().catch(() => false),
      burnBusyVisible: await this.page.getByRole('button', { name: /^Burning NFT, processing$/i }).isVisible().catch(() => false),
      mintIdleVisible: await this.page.getByRole('button', { name: /^Mint NFT$/i }).isVisible().catch(() => false),
      mintBusyVisible: await this.page.getByRole('button', { name: /^Minting NFT, processing$/i }).isVisible().catch(() => false),
      loadingBtnVisible: await this.page.getByRole('button', { name: /Loading NFT actions/i }).isVisible().catch(() => false),
      tokenId: await this.getTokenId(),
      hasNoKeyText: await this.page.locator('text="YOU DON\'T HAVE A KEY YET"').isVisible().catch(() => false),
      hasGateLink: await this.page.getByRole('link', { name: /Go to Token Gate/i }).isVisible().catch(() => false),
    };

    console.log('[NFT Utils] Current state:', state);
    return state;
  }
}
