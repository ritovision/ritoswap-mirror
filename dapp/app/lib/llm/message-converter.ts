// app/lib/llm/message-converter.ts
import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
  AIMessage,
} from '@langchain/core/messages';
import { isString } from './utils';
import type { UiMessage } from './types';

/**
 * Accepts any input and extracts textual content.
 * Handles strings, arrays of mixed pieces, or objects with { text } / { delta }.
 */
export function contentToText(content: unknown): string {
  // Plain string
  if (isString(content)) return content;

  // Array of mixed pieces (strings, {text}, {delta}, null, etc.)
  if (Array.isArray(content)) {
    return content
      .map((p) => {
        if (isString(p)) return p;
        if (p && typeof p === 'object') {
          const maybe = p as { text?: unknown; delta?: unknown };
          if (isString(maybe.text)) return maybe.text;
          if (isString(maybe.delta)) return maybe.delta;
        }
        return '';
      })
      .join('');
  }

  // Object with { text?: string }
  if (content && typeof content === 'object') {
    const maybe = content as { text?: unknown; delta?: unknown };
    if (isString(maybe.text)) return maybe.text;
    if (isString(maybe.delta)) return maybe.delta;
  }

  return '';
}

export function convertUiToModelMessages(
  uiMessages: UiMessage[],
  synthesizedSystem: string,
): BaseMessage[] {
  const messages: BaseMessage[] = [];

  // Add system message if needed
  const existingSystem = uiMessages.find((m) => m?.role === 'system');
  if (existingSystem) {
    const content = contentToText(
      existingSystem.content ?? existingSystem.parts ?? existingSystem.text ?? '',
    );
    messages.push(new SystemMessage(content || synthesizedSystem));
  } else {
    messages.push(new SystemMessage(synthesizedSystem));
  }

  // Convert remaining messages
  for (const msg of uiMessages) {
    if (!msg || msg.role === 'system') continue; // Skip system as we handled it above

    const content = contentToText(msg.content ?? msg.parts ?? msg.text ?? '');

    switch (msg.role) {
      case 'user':
        messages.push(new HumanMessage(content));
        break;
      case 'assistant':
        messages.push(new AIMessage(content));
        break;
      // Skip unknown roles
    }
  }

  return messages;
}

/** Backward-compat: prefer getType(); fall back to _getType() for older/mocked messages. */
function messageTypeOf(m: BaseMessage): string | undefined {
  const anyMsg = m as unknown as {
    getType?: () => string;
    _getType?: () => string;
  };
  if (typeof anyMsg.getType === 'function') return anyMsg.getType();
  if (typeof anyMsg._getType === 'function') return anyMsg._getType();
  return undefined;
}

export function buildSystemPrompt(
  uiMessages: UiMessage[],
  metadata: Record<string, unknown>,
  defaultSystem: string,
): string {
  const sysFromClient = uiMessages.find((m) => m?.role === 'system');
  const sysText = contentToText(
    sysFromClient?.content ?? sysFromClient?.parts ?? sysFromClient?.text ?? '',
  );

  let systemPrompt = sysText || defaultSystem;

  // Append NFT context when provided via metadata and no explicit system was sent
  if (!sysText && metadata && 'nftContext' in metadata) {
    const nftHumanSummary =
      typeof (metadata as { nftHumanSummary?: unknown }).nftHumanSummary === 'string'
        ? (metadata as { nftHumanSummary?: string }).nftHumanSummary
        : '';

    systemPrompt =
      `${defaultSystem}\n` +
      `NFT_CONTEXT_JSON:\n${JSON.stringify(
        (metadata as { nftContext?: unknown }).nftContext,
      )}\n` +
      `NFT_CONTEXT_HUMAN:\n${nftHumanSummary}`;
  }

  return systemPrompt;
}

export function summarizeMessages(messages: BaseMessage[]) {
  return {
    total: messages.length,
    first: messages[0] ? messageTypeOf(messages[0]) : undefined,
    last: messages.length ? messageTypeOf(messages[messages.length - 1]) : undefined,
    types: messages.map((m) => ({
      type: messageTypeOf(m),
      // Coerce to string safely for length without assuming a specific content type
      len: String((m as unknown as { content?: unknown }).content ?? '').length,
    })),
  };
}
