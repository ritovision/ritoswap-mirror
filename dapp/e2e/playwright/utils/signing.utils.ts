// dapp/e2e/playwright/utils/signing.utils.ts
import { Page } from '@playwright/test';

/**
 * Installs a Playwright-only override for `personal_sign` that:
 *  - sends the EXACT message to a Node-side signer (viem walletClient)
 *  - handles hex ("0x...") vs plain string correctly (EIP-191)
 *  - returns the signature deterministically from your PRIVATE_KEY
 *
 * This only affects `personal_sign`. Transactions & other RPCs are untouched.
 */
export async function installDeterministicPersonalSign(page: Page) {
  // Wire a Node-side signer that is hex-aware (exposed in test-setup.ts)
  // Then patch window.ethereum.request for personal_sign only.
  await page.addInitScript(() => {
    const installPatch = () => {
      const eth: any = (window as any).ethereum;
      if (!eth || typeof eth.request !== 'function') return;
      if (eth.__e2e_personal_sign_patched) return;

      const orig = eth.request.bind(eth);
      eth.request = async (args: any) => {
        try {
          if (args?.method === 'personal_sign') {
            const params = Array.isArray(args?.params) ? args.params : [];
            // EIP-191 personal_sign usually passes [message, address]
            const maybeMsg = params[0];
            const msg = typeof maybeMsg === 'string' ? maybeMsg : String(maybeMsg);

            // Call Node-side exact signer (exposed by test-setup.ts)
            if (typeof (window as any).__e2e_sign_message_exact !== 'function') {
              console.warn('[E2E] __e2e_sign_message_exact not available; falling back to wallet provider');
              return await orig(args);
            }
            const sig = await (window as any).__e2e_sign_message_exact(msg);
            return sig;
          }
          return await orig(args);
        } catch (e) {
          // Preserve original error semantics
          throw e;
        }
      };

      eth.__e2e_personal_sign_patched = true;
      console.log('[E2E] personal_sign override installed');
    };

    // Install immediately if provider exists…
    installPatch();
    // …and re-install when providers are (re)announced
    window.addEventListener('eip6963:announceProvider', () => {
      setTimeout(installPatch, 0);
    });
  });
}
