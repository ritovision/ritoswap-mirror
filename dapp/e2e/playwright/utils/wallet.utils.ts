import { Page, expect } from '@playwright/test';

export class WalletTestUtils {
  constructor(private page: Page) {}

  private connectCandidates() {
    const byHeader = this.page
      .getByTestId('header')
      .getByRole('button', { name: /^Connect Wallet$/i });

    const byRegion = this.page
      .getByLabel(/Connect wallet actions/i)
      .getByRole('button', { name: /^Connect Wallet$/i });

    const generic = this.page.getByRole('button', { name: /^Connect Wallet$/i }).first();

    return [byHeader, byRegion, generic];
  }

  private async waitForConnectUI(timeoutMs = 15000) {
    const disconnect = this.page.getByRole('button', { name: /^Disconnect wallet$/i });
    const candidates = this.connectCandidates();

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await disconnect.isVisible().catch(() => false)) {
        return { connected: true, connectBtn: null as any };
      }
      for (const loc of candidates) {
        if (await loc.isVisible().catch(() => false)) {
          return { connected: false, connectBtn: loc };
        }
      }
      await this.page.waitForTimeout(100);
    }
    return { connected: null as any, connectBtn: null as any };
  }

  private async openConnectModalFrom(connectBtn: ReturnType<Page['locator']>) {
    await connectBtn.click();

    const backdrop = this.page.locator('[class*="ConnectModal_backdrop"], [class*="ModalWrapper_backdrop"]');
    const dialog = this.page.getByRole('dialog');

    const anyModalVisible = async () =>
      (await backdrop.isVisible().catch(() => false)) ||
      (await dialog.isVisible().catch(() => false));

    for (let i = 0; i < 50; i++) {
      if (await anyModalVisible()) break;
      await this.page.waitForTimeout(100);
    }

    if (await backdrop.isVisible().catch(() => false)) {
      await expect(backdrop).toBeVisible({ timeout: 5_000 });
      return { backdrop, dialog };
    } else {
      await expect(dialog).toBeVisible({ timeout: 5_000 });
      return { backdrop, dialog };
    }
  }

  async openConnectModal() {
    const dialog = this.page.getByRole('dialog');
    const backdrop = this.page.locator('[class*="ConnectModal_backdrop"], [class*="ModalWrapper_backdrop"]');
    if (await dialog.isVisible().catch(() => false) || await backdrop.isVisible().catch(() => false)) {
      return { backdrop, dialog };
    }

    let state = await this.waitForConnectUI(15000);
    if (state.connected === true) {
      const disconnectButton = this.page.getByRole('button', { name: /^Disconnect wallet$/i });
      await expect(disconnectButton).toBeVisible({ timeout: 5_000 });
      return { backdrop: this.page.locator('__noop__'), dialog: this.page.locator('__noop__') };
    }
    if (state.connectBtn) {
      return this.openConnectModalFrom(state.connectBtn);
    }

    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('domcontentloaded');

    state = await this.waitForConnectUI(10000);
    if (state.connected === true) {
      const disconnectButton = this.page.getByRole('button', { name: /^Disconnect wallet$/i });
      await expect(disconnectButton).toBeVisible({ timeout: 5_000 });
      return { backdrop: this.page.locator('__noop__'), dialog: this.page.locator('__noop__') };
    }
    if (state.connectBtn) {
      return this.openConnectModalFrom(state.connectBtn);
    }

    throw new Error('Could not find a visible "Connect Wallet" button to open the modal');
  }

  private async findWalletOption(name?: string) {
    if (name) {
      const byListItem = this.page.getByRole('listitem', { name: new RegExp(name, 'i') });
      if (await byListItem.isVisible().catch(() => false)) return byListItem;

      const byAriaLabel = this.page.getByRole('listitem', { name: new RegExp(`Connect with\\s+${name}`, 'i') });
      if (await byAriaLabel.isVisible().catch(() => false)) return byAriaLabel;

      const byButton = this.page.getByRole('button', { name: new RegExp(name, 'i') });
      if (await byButton.isVisible().catch(() => false)) return byButton;
    }

    const walletItems = await this.page.getByRole('listitem').all();
    for (const item of walletItems) {
      const text = (await item.textContent())?.toLowerCase() || '';
      if (text && !text.includes('walletconnect')) {
        return item;
      }
    }

    const modalButtons = await this.page
      .locator('[role="dialog"], .modal, [class*="modal"], [class*="Modal"]')
      .locator('button')
      .all();

    for (const button of modalButtons) {
      const text = (await button.textContent())?.toLowerCase() || '';
      if (text && !text.includes('walletconnect')) {
        return button;
      }
    }

    throw new Error(`Could not find a wallet option${name ? ` for "${name}"` : ''}`);
  }

  private async waitForConnectionToSettle() {
    const connectingText = this.page.locator('[class*="loadingText"]').filter({ hasText: /Connecting/i });
    if (await connectingText.isVisible().catch(() => false)) {
      await expect(connectingText).not.toBeVisible({ timeout: 10_000 });
    }

    const backdrop = this.page.locator('[class*="ConnectModal_backdrop"], [class*="ModalWrapper_backdrop"]');
    const dialog = this.page.getByRole('dialog');

    const modalGone = async () =>
      !(await backdrop.isVisible().catch(() => false)) &&
      !(await dialog.isVisible().catch(() => false));

    for (let i = 0; i < 100; i++) {
      if (await modalGone()) break;
      await this.page.waitForTimeout(100);
    }

    if (await backdrop.count()) {
      await expect(backdrop).not.toBeVisible({ timeout: 10_000 });
    } else if (await dialog.count()) {
      await expect(dialog).not.toBeVisible({ timeout: 10_000 });
    }

    const disconnectButton = this.page.getByRole('button', { name: /^Disconnect wallet$/i });
    await expect(disconnectButton).toBeVisible({ timeout: 10_000 });
  }

  async isModalOpen(): Promise<boolean> {
    const dialog = this.page.getByRole('dialog');
    const backdrop = this.page.locator('[class*="ConnectModal_backdrop"], [class*="ModalWrapper_backdrop"]');
    return (await dialog.isVisible().catch(() => false)) || (await backdrop.isVisible().catch(() => false));
  }

  async connectFromOpenModal(walletName?: string) {
    const walletButton = await this.findWalletOption(walletName);
    await expect(walletButton).toBeVisible({ timeout: 5_000 });
    await walletButton.click();
    await this.waitForConnectionToSettle();
  }

  async connectWallet(walletName?: string) {
    const maybeConnected = await this.waitForConnectUI(5000);
    if (maybeConnected.connected === true) {
      await this.assertWalletConnected();
      return;
    }

    if (!(await this.isModalOpen())) {
      await this.openConnectModal();
    }

    await this.connectFromOpenModal(walletName);
  }

  async isWalletConnected(): Promise<boolean> {
    const disconnectButton = this.page.getByRole('button', { name: /^Disconnect wallet$/i });
    return await disconnectButton.isVisible().catch(() => false);
  }

  async assertWalletConnected() {
    const disconnectButton = this.page.getByRole('button', { name: /^Disconnect wallet$/i });
    await expect(disconnectButton).toBeVisible({ timeout: 10_000 });
  }

  async assertWalletDisconnected() {
    const connectFirst = this.page.getByRole('button', { name: /^Connect Wallet$/i }).first();
    await expect(connectFirst).toBeVisible({ timeout: 10_000 });
  }

  async getConnectedAddress(): Promise<string | null> {
    const patterns = [
      /0x[a-fA-F0-9]{40}/,
      /0x[a-fA-F0-9]{4,6}…[a-fA-F0-9]{4}/,
      /0x[a-fA-F0-9]{4,6}/,
    ];

    for (const pattern of patterns) {
      const el = this.page.getByText(pattern);
      if (await el.isVisible().catch(() => false)) {
        const text = await el.textContent();
        if (text) return text.trim();
      }
    }
    return null;
  }

  async disconnectWallet() {
    const disconnectButton = this.page.getByRole('button', { name: /^Disconnect wallet$/i });
    await expect(disconnectButton).toBeVisible({ timeout: 10_000 });
    await disconnectButton.click();

    const connectFirst = this.page.getByRole('button', { name: /^Connect Wallet$/i }).first();
    await expect(connectFirst).toBeVisible({ timeout: 10_000 });
  }

  async clickWalletConnectOption() {
    const wcBtn = this.page.getByRole('listitem', { name: /connect with\s+walletconnect/i });
    await expect(wcBtn).toBeVisible({ timeout: 10_000 });
    await wcBtn.click();
  }

  async waitForQrVisible(timeoutMs = 15_000) {
    const placeholder = this.page.getByRole('status', { name: /generating qr code/i });
    if (await placeholder.isVisible().catch(() => false)) {
      await expect(placeholder).toBeVisible({ timeout: 5_000 });
    }
    const qrImg = this.page.getByRole('img', { name: /qr code for wallet connection/i });
    await expect(qrImg).toBeVisible({ timeout: timeoutMs });
    return qrImg;
  }

  async pressModalBack() {
    const back = this.page.getByRole('button', { name: /go back to wallet selection/i });
    await expect(back).toBeVisible({ timeout: 5_000 });
    await back.click();
  }

  async waitForDefaultWalletList() {
    const title = this.page.getByRole('heading', { name: /connect your wallet/i });
    await expect(title).toBeVisible({ timeout: 10_000 });
  }
}

export class NavigationUtils {
  constructor(private page: Page) {}

  async goto(path: string) {
    await this.page.goto(path, { waitUntil: 'networkidle' });
    await this.page.waitForLoadState('domcontentloaded');
  }

  async isOnPath(path: string): Promise<boolean> {
    const url = new URL(this.page.url());
    return url.pathname === path;
  }
}

export class ScreenshotUtils {
  constructor(private page: Page) {}

  async capture(name: string, fullPage = false) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await this.page.screenshot({
      path: `test-results/screenshots/${name}-${timestamp}.png`,
      fullPage,
    });
  }

  async captureBeforeAfter(action: () => Promise<void>, name: string) {
    await this.capture(`${name}-before`);
    await action();
    await this.capture(`${name}-after`);
  }
}

export class TestHelper {
  wallet: WalletTestUtils;
  navigation: NavigationUtils;
  screenshot: ScreenshotUtils;

  constructor(page: Page) {
    this.wallet = new WalletTestUtils(page);
    this.navigation = new NavigationUtils(page);
    this.screenshot = new ScreenshotUtils(page);
  }
}
