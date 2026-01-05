// dapp/components/utilities/chatBot/ToolActivity/catalog/presenters/generate_image_with_alt.presenter.ts
import type { ChipLike, ToolChipPresenter } from '../types';
import type { ToolInputMap } from '@lib/mcp/generated/tool-catalog-types';

type JsonContent = { type: string; text?: string; data?: unknown };
type ToolWireResult = { content?: JsonContent[]; isError?: boolean };

type StoreImagePayload = {
  kind: 'store-image';
  name?: string;
  width?: number;
  height?: number;
  // other fields (mime, alt, dataBase64) are intentionally ignored for chip text
};

function extractJson(output: unknown): unknown | undefined {
  const res = output as ToolWireResult;
  const jsonItem = Array.isArray(res?.content) ? res.content.find((c) => c?.type === 'json') : undefined;
  return (jsonItem as JsonContent | undefined)?.data;
}

function asStoreImage(data: unknown): StoreImagePayload | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const k = (data as { kind?: unknown }).kind;
  if (k !== 'store-image') return undefined;
  const d = data as { name?: unknown; width?: unknown; height?: unknown };
  const name = typeof d.name === 'string' ? d.name : undefined;
  const width = typeof d.width === 'number' ? d.width : undefined;
  const height = typeof d.height === 'number' ? d.height : undefined;
  return { kind: 'store-image', name, width, height };
}

/**
 * Presenter for generate_image_with_alt:
 * - Label: "Image ready" on success, "Generating image…" pending, "Image failed" on error.
 * - Text shows "name (W×H)", or just "(W×H)", or just "name" depending on presence.
 */
export const presenter: (ToolChipPresenter<'generate_image_with_alt'> & { __typeRef?: ToolInputMap }) = {
  toolName: 'generate_image_with_alt',

  pending: (_chip: ChipLike) => ({
    label: 'Generating image…',
    text: '',
  }),

  success: (chip: ChipLike) => {
    const json = extractJson(chip.output);
    const payload = asStoreImage(json);

    const name = payload?.name ?? '';
    const size =
      typeof payload?.width === 'number' && typeof payload?.height === 'number'
        ? `(${payload.width}×${payload.height})`
        : '';

    // Ensure no leading/trailing spaces when one part is missing.
    const text = `${name} ${size}`.trim();

    return {
      label: 'Image ready',
      text,
    };
  },

  error: (chip: ChipLike) => ({
    label: 'Image failed',
    text: chip.errorText ?? 'An unexpected error occurred',
  }),
};
