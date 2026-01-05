// dapp/e2e/playwright/flows/chatbot.flow.ts
import { Page, expect } from '@playwright/test';

export interface ChatOptions {
  userMessage?: string;
  expectedAssistant?: string | RegExp;
  startModeButtonText?: string;
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
  }
}

/**
 * LEGACY: Starts a fresh conversation (clicks mode button)
 * Use smartChat() or sendChatMessage() for subsequent messages
 */
export async function chatOnce(page: Page, opts: ChatOptions = {}) {
  const {
    userMessage = 'hello',
    expectedAssistant = 'Hello back!',
    startModeButtonText = 'Freestyle Rap Mode',
  } = opts;

  await page.getByRole('tab', { name: /^RapBotRito$/i }).click();

  const startBtn = page.getByRole('button', { name: new RegExp(startModeButtonText, 'i') });
  await expect(startBtn).toBeVisible({ timeout: 10_000 });
  await startBtn.click();

  const input = page.getByPlaceholder('Drop your message here...');
  await input.fill(userMessage);

  const sendBtn = page.getByRole('button', { name: /^Send message$/i });
  await expect(sendBtn).toBeEnabled({ timeout: 5_000 });
  await sendBtn.click();

  const stopBtn = page.getByTestId('chat-stop-button');
  await stopBtn.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  await stopBtn.waitFor({ state: 'detached', timeout: 8_000 }).catch(() => {});

  await scrollChatToBottom(page);

  const lastAssistant = page.locator('[data-role="assistant"]').last();
  
  const matcher = expectedAssistant instanceof RegExp 
    ? expectedAssistant 
    : new RegExp(expectedAssistant, 'i');
  
  await expect(
    lastAssistant.getByText(matcher).first()
  ).toBeVisible({ timeout: 20_000 });
}

// Re-export helpers
export * from './chatbot-helpers.flow';
