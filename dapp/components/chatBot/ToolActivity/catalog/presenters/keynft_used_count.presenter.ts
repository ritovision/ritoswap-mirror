/*
// dapp/components/chatBot/ToolActivity/catalog/presenters/keynft_used_count.presenter.ts
*/
import type { ChipLike, ToolChipPresenter } from '../types';
import { publicConfig, publicEnv } from '@/app/config/public.env';

type JsonContent = { type: string; text?: string; data?: unknown };
type ToolWireResult = { content?: JsonContent[]; isError?: boolean };

function extractJson(output: unknown): unknown | undefined {
  const res = output as ToolWireResult;
  const json = Array.isArray(res?.content)
    ? res.content.find((c) => c?.type === 'json')
    : undefined;
  return json?.data;
}

function extractText(output: unknown): string | undefined {
  const res = output as ToolWireResult;
  const texts = Array.isArray(res?.content)
    ? res.content
        .filter((c): c is JsonContent & { text: string } => c?.type === 'text' && typeof c.text === 'string')
        .map((c) => c.text.trim())
    : [];
  return texts.length ? texts.join('\n') : undefined;
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

export const presenter: ToolChipPresenter<'keynft_used_count'> = {
  toolName: 'keynft_used_count',

  pending: () => ({
    label: 'Counting Used Keys',
    text: '',
  }),

  success: (chip: ChipLike) => {
    const json = extractJson(chip.output);
    const obj = json && typeof json === 'object' ? (json as Record<string, unknown>) : undefined;
    const total = typeof obj?.total === 'number' ? obj.total : undefined;

    const fallback = extractText(chip.output);
    const value = typeof total === 'number' ? String(total) : fallback ?? '';

    return {
      label: `Used Keys Total (${activeNetworkName()})`,
      text: value,
    };
  },

  error: (chip: ChipLike) => ({
    label: 'Failed to Count Used Keys',
    text: chip.errorText ?? 'An unexpected error occurred',
  }),
};
