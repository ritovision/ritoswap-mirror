// dapp/e2e/playwright/utils/chat.utils.ts
import { Page, expect, Locator } from '@playwright/test';

/**
 * Centralized chat selectors with safe defaults and deprecated fallbacks.
 * Replace fallbacks with stable data-testid/role selectors in the app when possible.
 */
export const ChatSelectors = {
  // Prefer a data-testid you control; fallback keeps current tests working.
  messagesContainer:
    '[data-testid="messages-container"], [class*="messagesContainer"]',

  // Role=button with accessible name "Stop" is the goal; we include fallbacks.
  stopButtonCandidates: [
    // Preferred (add one of these to your app):
    'role=button[name=/Stop streaming|Stop/i]',
    'button[aria-label="Stop"]',
    'button[data-testid="stop-streaming"]',
    // Deprecated fallback (CSS module; remove once app has stable testids):
    'button.ChatForm_stopButton__jVZfh',
  ],

  // Assistant bubbles are already nicely marked in your app:
  assistantBubble: '[data-role="assistant"]',
};

/**
 * Pick the first visible locator from a list of selector candidates.
 * Optionally waits up to `timeout` for any to appear.
 */
async function firstVisibleLocator(
  page: Page,
  selectors: string[],
  timeout = 2000
): Promise<Locator | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const sel of selectors) {
      const loc = sel.startsWith('role=')
        ? page.getByRole(
            // crude parser for `role=button[name=/Stop/i]`
            sel.includes('button') ? 'button' as any : 'button' as any,
            (() => {
              const nameMatch = sel.match(/name=(.+)$/i);
              if (!nameMatch) return {};
              const evalName = new Function(
                'RegExp',
                `return ${nameMatch[1]};`
              )(RegExp);
              return { name: evalName };
            })()
          )
        : page.locator(sel);
      if (await loc.isVisible().catch(() => false)) return loc;
    }
    await page.waitForTimeout(100);
  }
  return null;
}

/**
 * Scroll the chat to the bottom so the latest messages are in view.
 */
export async function scrollChatToBottom(page: Page, timeout = 3000) {
  const container = await (async () => {
    const loc = page.locator(ChatSelectors.messagesContainer).first();
    if (await loc.isVisible().catch(() => false)) return loc;
    // give the DOM a moment to attach
    await page.waitForTimeout(150);
    return (await loc.isVisible().catch(() => false)) ? loc : null;
  })();

  if (!container) return;

  await container.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });

  // Allow layout to settle; prefer a micro-wait to a long sleep
  await page.waitForTimeout(100);
}

/**
 * Wait for the model's streaming response lifecycle:
 * 1) Stop button appears (streaming started)
 * 2) Stop button disappears (streaming finished)
 *
 * This is resilient to selector drift by using multiple candidates.
 */
export async function waitForStreamingToFinish(
  page: Page,
  opts: {
    appearTimeout?: number;
    finishTimeout?: number;
    customStopSelectors?: string[];
  } = {}
) {
  const {
    appearTimeout = 5000,
    finishTimeout = 10000,
    customStopSelectors,
  } = opts;

  const candidates = customStopSelectors ?? ChatSelectors.stopButtonCandidates;

  // Wait for stream to start (best-effort)
  const stopBtn = await firstVisibleLocator(page, candidates, appearTimeout);

  if (stopBtn) {
    // If it appeared, wait for it to go away (either hidden or detached)
    await Promise.race([
      stopBtn.waitFor({ state: 'hidden', timeout: finishTimeout }).catch(() => {}),
      stopBtn.waitFor({ state: 'detached', timeout: finishTimeout }).catch(() => {}),
    ]);
  } else {
    // If it never appeared, we don't fail—some responses may render fast.
    // Optionally, you could assert something else here if your UX guarantees streaming.
  }
}

/**
 * Get the locator for the last assistant message bubble.
 */
export function getLastAssistantMessage(page: Page): Locator {
  return page.locator(ChatSelectors.assistantBubble).last();
}

/**
 * Assert the last assistant message contains text matching a string or RegExp.
 */
export async function expectLastAssistantToContain(
  page: Page,
  expected: string | RegExp,
  timeout = 20_000
) {
  const matcher = expected instanceof RegExp ? expected : new RegExp(expected, 'i');
  const lastAssistant = getLastAssistantMessage(page);
  await expect(lastAssistant.getByText(matcher).first()).toBeVisible({ timeout });
}

/**
 * Convenience: send-message lifecycle used by flows.
 * (Optional wrapper if you want to centralize sending + waits here later.)
 */
export async function afterMessageRenderSettled(
  page: Page,
  options: { scroll?: boolean; stopSelectors?: string[] } = {}
) {
  await waitForStreamingToFinish(page, {
    customStopSelectors: options.stopSelectors,
  });
  if (options.scroll !== false) {
    await scrollChatToBottom(page);
  }
}
