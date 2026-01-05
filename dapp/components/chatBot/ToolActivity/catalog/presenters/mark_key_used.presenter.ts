// dapp/components/utilities/chatBot/ToolActivity/catalog/presenters/mark_key_used.presenter.ts
import type { ChipLike, ToolChipPresenter } from '../types';
import { publicConfig, publicEnv } from '@config/public.env';

type JsonContent = { type: string; text?: string; data?: unknown };
type ToolWireResult = { content?: JsonContent[]; isError?: boolean };

type MarkKeyUsedJson = {
  tokenId?: unknown;
  chainName?: unknown;
  address?: unknown;
  usedAt?: unknown;
};

function extractJsonFromOutput(output: unknown): unknown | undefined {
  const res = output as ToolWireResult;
  const json = Array.isArray(res?.content)
    ? res.content.find((c) => c?.type === 'json')
    : undefined;
  return json?.data;
}

function extractTextFromOutput(output: unknown): string | undefined {
  const res = output as ToolWireResult;
  const texts = Array.isArray(res?.content)
    ? res.content
        .filter((c) => c?.type === 'text' && typeof c.text === 'string')
        .map((c) => (c.text as string).trim())
    : [];
  return texts.length ? texts.join('\n') : undefined;
}

function shortAddr(addr?: string): string | undefined {
  if (!addr || typeof addr !== 'string') return undefined;
  return /^0x[a-fA-F0-9]{40}$/.test(addr)
    ? `${addr.slice(0, 6)}…${addr.slice(-4)}`
    : undefined;
}

function activeNetworkName(): string {
  switch (publicConfig.activeChain) {
    case 'ethereum':
      return 'Ethereum';
    case 'sepolia':
      return 'Sepolia';
    case 'ritonet':
      return publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME || 'RitoNet';
    default:
      return publicConfig.activeChain;
  }
}

/** Format ISO timestamp to "MM/DD/YYYY HH:MM:SS" (user locale TZ for time). */
function formatUsedAtForUser(iso?: string | null): string | undefined {
  if (!iso || typeof iso !== 'string') return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;

  const datePart = d.toLocaleDateString('en-US');
  const timePart = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return `${datePart} ${timePart}`;
}

function maybeWalletFriendly(errorText?: string): string | undefined {
  if (!errorText) return undefined;
  const walletLike = /(wallet|connect|signed?\s*in|jwt|address|owner)/i.test(errorText);
  return walletLike ? 'Your wallet must be connected to use this' : undefined;
}

export const presenter: ToolChipPresenter<'mark_key_used'> = {
  toolName: 'mark_key_used',

  // Label-only pending; empty text so no body renders
  pending: () => ({
    label: 'Marking Key as Used',
    text: '',
  }),

  success: (chip: ChipLike) => {
    const json = extractJsonFromOutput(chip.output);

    if (json && typeof json === 'object') {
      const data = json as MarkKeyUsedJson;

      const id = typeof data.tokenId === 'number' ? data.tokenId : undefined;
      const chainName =
        typeof data.chainName === 'string' ? data.chainName : activeNetworkName();
      const addr =
        typeof data.address === 'string' ? shortAddr(data.address) : undefined;
      const usedAtIso = typeof data.usedAt === 'string' ? data.usedAt : undefined;

      const idPart = Number.isFinite(id) ? `#${id}` : '';
      const who = addr ? ` by ${addr}` : '';

      const whenFormatted = formatUsedAtForUser(usedAtIso);
      const when = whenFormatted ? ` at ${whenFormatted}` : '';

      return {
        label: 'Marked Key as Used.',
        text: `Key ${idPart} on ${chainName}${who}${when}`,
      };
    }

    // Fallback to text if needed
    const text = extractTextFromOutput(chip.output);
    return {
      label: 'Marked Key as Used.',
      text: text || '',
    };
  },

  error: (chip: ChipLike) => {
    const friendly = maybeWalletFriendly(chip.errorText);
    return {
      label: 'Failed to Mark Key as Used.',
      text: friendly ?? chip.errorText ?? 'An unexpected error occurred',
    };
  },
};
