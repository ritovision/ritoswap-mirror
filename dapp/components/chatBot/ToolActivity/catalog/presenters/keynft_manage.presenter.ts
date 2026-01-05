// dapp/components/utilities/chatBot/ToolActivity/catalog/presenters/keynft_manage.presenter.ts
import type { ChipLike, ToolChipPresenter } from '../types';

type JsonContent = { type: string; text?: string; data?: unknown };
type ToolWireResult = { content?: JsonContent[]; isError?: boolean };

type TimelineEvent = {
  phase: 'query' | 'burn' | 'mint' | 'result' | 'error';
  message: string;
  hash?: string;
  url?: string;
  tokenId?: string;
};

function extractJson(output: unknown): unknown | undefined {
  const res = output as ToolWireResult;
  const jsonItem = Array.isArray(res?.content) ? res.content.find((c) => c?.type === 'json') : undefined;
  return (jsonItem as JsonContent | undefined)?.data;
}

function extractText(output: unknown): string | undefined {
  const res = output as ToolWireResult;
  const texts = Array.isArray(res?.content)
    ? res.content
        .filter((c) => c?.type === 'text' && typeof c.text === 'string')
        .map((c) => (c.text as string).trim())
    : [];
  return texts.length ? texts.join('\n') : undefined;
}

function getActionFromInput(input: unknown): 'mint' | 'burn' | 'query' | undefined {
  try {
    const a = (input as { action?: unknown } | undefined)?.action;
    return a === 'mint' || a === 'burn' || a === 'query' ? a : undefined;
  } catch {}
  return undefined;
}

function summarizeTimeline(tl?: TimelineEvent[]): string | undefined {
  if (!Array.isArray(tl) || tl.length === 0) return undefined;
  // Keep it short but illustrative; show the last 2–3 steps
  const last = tl.slice(-3).map((e) => e.message).filter(Boolean);
  return last.length ? last.join(' → ') : undefined;
}

/**
 * Presenter for manage_key_nft:
 * - Never includes tx hashes or explorer URLs in the chip.
 * - Shows token ids, color properties, and a short timeline summary.
 */
export const presenter: ToolChipPresenter<'manage_key_nft'> = {
  toolName: 'manage_key_nft',

  pending: (chip: ChipLike) => {
    const action = getActionFromInput(chip.input) || 'query';
    const verb = action === 'mint' ? 'Minting' : action === 'burn' ? 'Burning' : 'Querying';
    return { label: `Key NFT: ${verb}…`, text: '' };
  },

  success: (chip: ChipLike) => {
    const json = extractJson(chip.output);
    const jsonAction = (json as { action?: unknown } | undefined)?.action;
    const action: 'mint' | 'burn' | 'query' =
      (jsonAction === 'mint' || jsonAction === 'burn' || jsonAction === 'query'
        ? jsonAction
        : getActionFromInput(chip.input)) || 'query';
    const timeline: TimelineEvent[] | undefined = Array.isArray((json as { timeline?: unknown } | undefined)?.timeline)
      ? ((json as { timeline?: TimelineEvent[] }).timeline)
      : undefined;

    // Prefer tool-provided text if available (concise), but ensure it doesn't contain tx URLs (tool text is trusted).
    const toolText = extractText(chip.output);
    if (toolText) {
      const label =
        action === 'mint' ? 'Key NFT Minted.' :
        action === 'burn' ? 'Key NFT Burned.' :
        'Key NFT Status.';
      return { label, text: toolText };
    }

    // Build a short derived summary without any tx hashes or URLs
    const parts: string[] = [];
    if (action === 'query') {
      if ((json as { hasToken?: boolean } | undefined)?.hasToken && (json as { tokenId?: string } | undefined)?.tokenId) {
        const colors = (json as { colors?: { backgroundColor?: string; keyColor?: string } } | undefined)?.colors;
        const colorBits =
          colors && (colors.backgroundColor || colors.keyColor)
            ? ` (bg: ${colors.backgroundColor ?? '—'}, key: ${colors.keyColor ?? '—'})`
            : '';
        parts.push(`Has token #${(json as { tokenId?: string } | undefined)?.tokenId}${colorBits}`);
      } else {
        parts.push('No NFT for this signer.');
      }
    } else if (action === 'burn') {
      if ((json as { burnedTokenId?: string } | undefined)?.burnedTokenId) {
        parts.push(`Burned token #${(json as { burnedTokenId?: string }).burnedTokenId}.`);
      } else {
        parts.push('No NFT to burn.');
      }
    } else if (action === 'mint') {
      if ((json as { tokenId?: string } | undefined)?.tokenId) {
        const colors = (json as { colors?: { backgroundColor?: string; keyColor?: string } } | undefined)?.colors;
        const colorBits =
          colors && (colors.backgroundColor || colors.keyColor)
            ? ` (bg: ${colors.backgroundColor ?? '—'}, key: ${colors.keyColor ?? '—'})`
            : '';
        const prev = (json as { burnedTokenId?: string } | undefined)?.burnedTokenId ? `Previous #${(json as { burnedTokenId?: string }).burnedTokenId} burned. ` : '';
        parts.push(`${prev}Minted #${(json as { tokenId?: string }).tokenId}${colorBits}.`);
      } else {
        parts.push('Mint attempted, but token not detected on re-query.');
      }
    }

    const tail = summarizeTimeline(timeline);
    const text = tail ? `${parts.join(' ')}\n${tail}` : parts.join(' ');

    const label =
      action === 'mint' ? 'Key NFT Minted.' :
      action === 'burn' ? 'Key NFT Burned.' :
      'Key NFT Status.';

    return { label, text };
  },

  error: (chip: ChipLike) => ({
    label: 'Key NFT Action Failed.',
    text: chip.errorText ?? 'An unexpected error occurred.',
  }),
};
