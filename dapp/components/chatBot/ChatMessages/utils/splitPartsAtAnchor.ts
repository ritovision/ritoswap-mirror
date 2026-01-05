// dapp/components/utilities/chatBot/ChatMessages/utils/splitPartsAtAnchor.ts
import type { Message, MessagePart } from '../types';

export type ToolAnchor = { partIndex: number; charOffset: number };

export function splitPartsAtAnchor(parts: Message['parts'], anchor?: ToolAnchor) {
  if (!anchor) return { before: parts, after: [] as MessagePart[] };

  const { partIndex, charOffset } = anchor;
  const safeIndex = Math.max(0, Math.min(partIndex, Math.max(0, parts.length - 1)));

  const before: MessagePart[] = [];
  const after: MessagePart[] = [];

  // push all parts strictly before the anchor part
  for (let i = 0; i < safeIndex; i++) before.push(parts[i]);

  const target = parts[safeIndex];
  if (!target) {
    return { before: parts, after };
  }

  const text = typeof target.text === 'string' ? target.text : String(target.text ?? '');
  const safeOffset = Math.max(0, Math.min(charOffset, text.length));

  const head = text.slice(0, safeOffset);
  const tail = text.slice(safeOffset);

  if (head) before.push({ type: 'text', text: head });
  if (tail) after.push({ type: 'text', text: tail });

  // remaining parts go into "after"
  for (let i = safeIndex + 1; i < parts.length; i++) after.push(parts[i]);

  return { before, after };
}
