// app/hooks/useHydrateToolImages.ts
'use client';

import { useEffect, useRef } from 'react';
import { useToolActivityStore } from '@store/toolActivity';
import { useLocalImageStore } from '@store/toolImageStore';

/**
 * Local shapes to avoid `any` while keeping behavior unchanged.
 */
type Chip = { output?: { content?: unknown } };
type Group = { chips?: Record<string, Chip> };
type JsonContentItem = { type?: unknown; data?: unknown };
type StoreImagePayload = {
  kind?: unknown;
  name?: unknown;
  mime?: unknown;
  width?: unknown;
  height?: unknown;
  alt?: unknown;
  dataBase64?: unknown;
};

function isJsonItem(v: unknown): v is { type: 'json'; data?: unknown } {
  return typeof (v as JsonContentItem)?.type === 'string' && (v as JsonContentItem).type === 'json';
}

function isStoreImagePayload(v: unknown): v is StoreImagePayload & { kind: 'store-image' } {
  return (v as StoreImagePayload)?.kind === 'store-image';
}

/**
 * Watches tool outputs in the ToolActivity store; when it sees our
 * { kind: 'store-image', ... } JSON, it writes the pixels into the local image store.
 * No base64 is ever appended to the chat text; this hook is purely clientside.
 */
export default function useHydrateToolImages() {
  const groups = useToolActivityStore((s) => s.groups);
  const putFromBase64 = useLocalImageStore((s) => s.putFromBase64);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Walk all tool outputs and hydrate any new images
    Object.values(groups as Record<string, unknown>).forEach((g) => {
      const group = g as Group;
      if (!group || !group.chips) return;

      Object.values(group.chips).forEach((chipLike) => {
        const chip = chipLike as Chip;
        const content = chip.output?.content;

        const list = Array.isArray(content) ? (content as unknown[]) : [];
        for (const c of list) {
          const item = c as JsonContentItem;
          const d = isJsonItem(item) ? item.data : null;
          if (!isStoreImagePayload(d)) continue;

          const name = String(d.name || '');
          if (!name || seen.current.has(name)) continue;
          seen.current.add(name);

          putFromBase64({
            name,
            mime: String(d.mime || 'image/png'),
            width: Number(d.width || 0),
            height: Number(d.height || 0),
            alt: String(d.alt || 'Generated image'),
            dataBase64: String(d.dataBase64 || ''),
          });
        }
      });
    });
  }, [groups, putFromBase64]);
}
