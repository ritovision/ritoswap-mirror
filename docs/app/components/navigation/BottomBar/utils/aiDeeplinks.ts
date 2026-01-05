export type AIProvider = 'chatgpt' | 'claude' | 'perplexity';

/**
 * Builds a deeplink URL for the specified AI provider with the given prompt and page URL
 * @param provider - The AI provider (chatgpt, claude, or perplexity)
 * @param prompt - The user's prompt text
 * @param pageUrl - The current page URL to include in the query
 * @returns The formatted deeplink URL
 */
export function buildDeeplink(
  provider: AIProvider,
  prompt: string,
  pageUrl: string
): string {
  const encodedPrompt = encodeURIComponent(prompt);
  const encodedUrl = encodeURIComponent(pageUrl);

  switch (provider) {
    case 'chatgpt':
      return `https://chat.openai.com/?q=${encodedPrompt}+${encodedUrl}`;

    case 'claude':
      return `https://claude.ai/new?q=${encodedPrompt}+${encodedUrl}`;

    case 'perplexity':
      return `https://www.perplexity.ai/search?q=${encodedPrompt}:+${encodedUrl}`;

    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

/**
 * Opens an AI provider deeplink in a new tab
 * @param provider - The AI provider to open
 * @param prompt - The user's prompt text
 * @param pageUrl - The current page URL
 */
export function openAIDeeplink(
  provider: AIProvider,
  prompt: string,
  pageUrl: string
): void {
  const url = buildDeeplink(provider, prompt, pageUrl);
  window.open(url, '_blank', 'noopener,noreferrer');
}
