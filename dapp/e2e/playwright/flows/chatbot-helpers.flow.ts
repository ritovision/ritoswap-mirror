// dapp/e2e/playwright/flows/chatbot-helpers.flow.ts
import { Page, expect } from '@playwright/test';

/**
 * Deletes the current conversation and confirms the modal
 */
export async function deleteChatConversation(page: Page) {
  const deleteButton = page.getByRole('button', { name: /Delete conversation/i });
  await expect(deleteButton).toBeVisible({ timeout: 5_000 });
  await deleteButton.click();

  const modal = page.getByTestId('base-modal');
  await expect(modal).toBeVisible({ timeout: 5_000 });

  const confirmButton = modal.getByTestId('confirm-delete-button');
  await expect(confirmButton).toBeVisible({ timeout: 5_000 });
  await confirmButton.click();

  await expect(modal).not.toBeVisible({ timeout: 5_000 });

  console.log('[Chat Helper] Conversation deleted');
}

/**
 * Checks if already in a conversation (mode button not visible)
 */
export async function isInConversation(page: Page): Promise<boolean> {
  const modeButton = page.getByRole('button', { name: /Freestyle Rap Mode/i });
  const isVisible = await modeButton.isVisible().catch(() => false);
  return !isVisible;
}

/**
 * Scrolls the chat container to the bottom to reveal the latest message
 */
async function scrollChatToBottom(page: Page) {
  const messagesContainer = page.locator('[class*="messagesContainer"]').first();
  
  if (await messagesContainer.isVisible().catch(() => false)) {
    await messagesContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    
    await page.waitForTimeout(300);
    
    console.log('[Chat Helper] Scrolled chat to bottom');
  }
}

/**
 * Sends a message in an existing conversation (no mode button click)
 */
export async function sendChatMessage(
  page: Page, 
  message: string, 
  expectedResponse?: string | RegExp,
  options?: {
    skipResponseCheck?: boolean;
    scrollToBottom?: boolean;
  }
) {
  const { skipResponseCheck = false, scrollToBottom = true } = options || {};

  const input = page.getByPlaceholder('Drop your message here...');
  await expect(input).toBeVisible({ timeout: 5_000 });
  await input.fill(message);

  const sendBtn = page.getByRole('button', { name: /^Send message$/i });
  await expect(sendBtn).toBeEnabled({ timeout: 5_000 });
  await sendBtn.click();

  const stopBtn = page.getByTestId('chat-stop-button');
  await stopBtn.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  await stopBtn.waitFor({ state: 'detached', timeout: 8_000 }).catch(() => {});

  if (scrollToBottom) {
    await scrollChatToBottom(page);
  }

  if (!skipResponseCheck && expectedResponse) {
    const matcher = expectedResponse instanceof RegExp ? expectedResponse : new RegExp(expectedResponse, 'i');
    const lastAssistant = page.locator('[data-role="assistant"]').last();
    await expect(lastAssistant.getByText(matcher).first()).toBeVisible({ timeout: 20_000 });
  }

  console.log('[Chat Helper] Message sent and response received');
}

/**
 * Resets conversation and starts fresh mode
 */
export async function resetAndStartMode(page: Page, modeButtonText: string = 'Freestyle Rap Mode') {
  if (await isInConversation(page)) {
    await deleteChatConversation(page);
  }

  const modeButton = page.getByRole('button', { name: new RegExp(modeButtonText, 'i') });
  await expect(modeButton).toBeVisible({ timeout: 10_000 });
  await modeButton.click();

  console.log('[Chat Helper] Mode started:', modeButtonText);
}

/**
 * Smart chat function - auto-detects if in conversation or needs to start mode
 */
export async function smartChat(
  page: Page,
  message: string,
  expectedResponse?: string | RegExp,
  options?: {
    modeButtonText?: string;
    resetFirst?: boolean;
    skipResponseCheck?: boolean;
    scrollToBottom?: boolean;
  }
) {
  const { 
    modeButtonText = 'Freestyle Rap Mode', 
    resetFirst = false,
    skipResponseCheck = false,
    scrollToBottom = true 
  } = options || {};

  await page.getByRole('tab', { name: /^RapBotRito$/i }).click();

  if (resetFirst) {
    await resetAndStartMode(page, modeButtonText);
  } else {
    const inConvo = await isInConversation(page);
    if (!inConvo) {
      await resetAndStartMode(page, modeButtonText);
    }
  }

  await sendChatMessage(page, message, expectedResponse, { skipResponseCheck, scrollToBottom });
}

/* ============================================================================
   INLINE RENDERER ASSERTIONS + MINI-FLOW MAP
============================================================================ */

function lastAssistant(page: Page) {
  return page.locator('[data-role="assistant"]').last();
}

export async function assertLastAssistantHasInlineSVG(page: Page) {
  const bubble = lastAssistant(page);
  const svg = bubble.locator('svg').first();
  await expect(svg).toBeVisible({ timeout: 20_000 });
}

export async function assertChainLogoVisible(page: Page, chainName?: string) {
  const bubble = lastAssistant(page);
  const role = chainName
    ? bubble.getByRole('img', { name: new RegExp(`${chainName}\\s+logo`, 'i') })
    : bubble.getByRole('img', { name: /logo/i });
  await expect(role.first()).toBeVisible({ timeout: 20_000 });
}

export async function assertGifVisible(page: Page) {
  const bubble = lastAssistant(page);
  const role = bubble.getByRole('img', { name: /gif/i });
  await expect(role.first()).toBeVisible({ timeout: 20_000 });
}

export async function assertInlineImageVisible(page: Page, altSubstring?: string | RegExp) {
  const bubble = lastAssistant(page);
  if (altSubstring) {
    await expect(
      bubble.getByRole('img', { name: altSubstring instanceof RegExp ? altSubstring : new RegExp(altSubstring, 'i') }).first()
    ).toBeVisible({ timeout: 20_000 });
  } else {
    await expect(bubble.getByRole('img').first()).toBeVisible({ timeout: 20_000 });
  }
}

export const INLINE_RENDERER_TESTS: Record<
  string,
  { trigger: string; assert: (page: Page) => Promise<void> }
> = {
  keynft: {
    trigger: 'show keynft',
    assert: assertLastAssistantHasInlineSVG,
  },
  logoEth: {
    trigger: 'show ethereum logo',
    assert: (page) => assertChainLogoVisible(page, 'Ethereum'),
  },
  gifParty: {
    trigger: 'send a celebratory gif',
    assert: assertGifVisible,
  },
  imageRito: {
    trigger: 'show ritoswap logo image',
    assert: (page) => assertInlineImageVisible(page, /RitoSwap logo/i),
  },
};

export async function runInlineRendererTest(
  page: Page,
  key: keyof typeof INLINE_RENDERER_TESTS
) {
  const cfg = INLINE_RENDERER_TESTS[key];
  if (!cfg) throw new Error(`Unknown inline renderer test key: ${String(key)}`);

  await smartChat(page, cfg.trigger, undefined, {
    skipResponseCheck: true,
    scrollToBottom: true,
  });

  await cfg.assert(page);
  console.log(`✅ Inline renderer "${String(key)}" passed`);
}
