import { test, expect } from '@playwright/test';
import { setupTest } from './wallet';
import { e2eEnv, logE2eEnvOnce } from './env';
import {
  mintKey,
  burnKey,
  playSecretSong,
  chatOnce,
  smartChat,
  submitMsgRito,
  installAIMock,
  composeHandlers,
  nftCountHandler,
  musicCommandHandler,
  inlineRendererHandler,
  helloHandler,
  echoHandler,
  waitForMusicBar,
  toggleMusicBar,
  assertMusicBarSong,
  assertMusicBarPlaying,
  assertMusicBarPaused,
  runInlineRendererTest,
  unlockTokenGateWithRetry,
} from './utils/index';
import { ensureConnected } from './flows/wallet.flow';
import { burnIfKeyPresent } from './flows/nft.flow';

test.describe.configure({ mode: 'serial' });

const WALLET_NAME = 'Test Wallet';

test.describe('Mint → Gate → Music → Chat → Msg Rito → Burn (REAL Sepolia tx)', () => {
  test('happy path with music + chatbot + MCP tools + inline renderers', async ({ page }) => {
    test.setTimeout(240000);
    logE2eEnvOnce();

    const setup = await setupTest(page, {
      clearStorage: true,
      injectWallet: true,
      persistConnection: true,
      walletConfig: {
        address: e2eEnv.address,
        privateKey: e2eEnv.privateKey,
        chainId: e2eEnv.chainId,
        walletName: WALLET_NAME,
      },
    });

    // Passthrough for the gate API (avoid mock interception)
    await page.route('**/api/form-submission-gate', (route) => route.continue());

    await installAIMock(page, {
      debug: true,
      handler: composeHandlers(
        helloHandler(),
        nftCountHandler(),
        musicCommandHandler(),
        inlineRendererHandler(),
        echoHandler()
      ),
    });

    // --- Mint
    await page.goto('/mint', { waitUntil: 'domcontentloaded' });
    await setup.waitForProvider();                // provider only (no accounts yet)
    await ensureConnected(page, WALLET_NAME);     // opens modal + connects
    await setup.waitForAccounts();                // now accounts should exist

    // 🔐 Safety: ensure clean state before minting (burn if an NFT already exists)
    await burnIfKeyPresent(page);

    await page.waitForTimeout(500);

    await mintKey(page);
    await page.waitForTimeout(15_000);

    // --- Gate
    await page.goto('/gate', { waitUntil: 'domcontentloaded' });
    await setup.waitForProvider();                // provider present after nav
    // With persistConnection=true, we should still be connected.
    // Guard in case SSR raced: re-assert connected.
    await ensureConnected(page, WALLET_NAME);
    await setup.waitForAccounts();

    await unlockTokenGateWithRetry(page, {
      maxAttempts: 3,
      waitForResponseMs: 15_000,
      waitForUIVisibleMs: 15_000,
      refreshOnFail: true,
      pauseBetweenAttemptsMs: 800,
    });

    const gatedTextarea = page.locator('#gatedTextarea');
    await expect(gatedTextarea).toBeVisible({ timeout: 5_000 });

    await playSecretSong(page);

    await chatOnce(page, {
      userMessage: 'how many NFTs are there?',
      expectedAssistant: /There are \d+ NFTs/i,
    });

    await smartChat(page, 'play altcoin love', undefined, {
      skipResponseCheck: true,
      scrollToBottom: true,
    });

    await waitForMusicBar(page);
    await assertMusicBarSong(page, 'Altcoin_Love');
    await assertMusicBarPlaying(page);

    await toggleMusicBar(page);
    await assertMusicBarPaused(page);

    await runInlineRendererTest(page, 'keynft');
    await runInlineRendererTest(page, 'logoEth');
    await runInlineRendererTest(page, 'gifParty');
    await runInlineRendererTest(page, 'imageRito');

    await submitMsgRito(page, `Playwright gated submission @ ${new Date().toISOString()}`);
    await page.waitForTimeout(800);

    // --- Burn
    await page.goto('/mint', { waitUntil: 'domcontentloaded' });
    await setup.waitForProvider();
    await ensureConnected(page, WALLET_NAME);
    await setup.waitForAccounts();

    await burnKey(page);
    await page.waitForTimeout(15_000);

    const initialState = await page
      .locator('text="YOU DON\'T HAVE A KEY YET"')
      .isVisible()
      .catch(() => false);
    if (initialState) {}
  });
});
