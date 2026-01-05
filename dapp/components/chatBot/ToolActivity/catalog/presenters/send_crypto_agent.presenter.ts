/* dapp/components/utilities/chatBot/ToolActivity/catalog/presenters/send_crypto_agent.presenter.ts */
import type { ChipLike, ToolChipPresenter } from '../types';

type JsonContent = { type: string; text?: string; data?: unknown };
type ToolWireResult = { content?: JsonContent[]; isError?: boolean };

type AgentJson = {
  success?: boolean;
  decision?: 'send' | 'deny' | string;
  reason?: string;
  output?: string;
  txHash?: string;
  to?: string;
  from?: string;
  chainId?: number;
  chainName?: string;
  network?: string;
  sentAmountEth?: number;
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

function formatEthAmount(val: unknown): string | undefined {
  const n = typeof val === 'number' ? val : typeof val === 'string' ? Number(val) : NaN;
  if (!Number.isFinite(n)) return undefined;
  let s = n.toFixed(6).replace(/(?:\.0+|(\.\d*?[1-9]))0+$/, '$1');
  if (s.endsWith('.')) s = s.slice(0, -1);
  if (s.startsWith('0.')) s = s.slice(1);
  return s;
}

function normalizeNetworkName(n?: unknown): string | undefined {
  if (!n) return undefined;
  if (typeof n === 'string' && n.trim().length > 0) {
    const s = n.trim();
    if (/[A-Z]/.test(s)) return s;
    return s[0].toUpperCase() + s.slice(1);
  }
  if (typeof n === 'number') return `Chain ${n}`;
  return undefined;
}

export const presenter: ToolChipPresenter<'send_crypto_agent'> = {
  toolName: 'send_crypto_agent',

  // Label-only pending (no body)
  pending: (_chip: ChipLike) => {
    return { label: 'Agent: Evaluating', text: '' };
  },

  success: (chip: ChipLike) => {
    const json = extractJsonFromOutput(chip.output);

    if (json && typeof json === 'object') {
      const data = json as Partial<AgentJson>;
      const decision = String(data.decision ?? '').toLowerCase();

      if (decision === 'send') {
        const amt =
          formatEthAmount(data.sentAmountEth) ||
          // fallback to any text content if needed
          undefined;

        const to =
          shortAddr(data.to) ||
          (typeof data.to === 'string' ? data.to : 'recipient');

        const network =
          normalizeNetworkName(data.network) ||
          normalizeNetworkName(data.chainName) ||
          (typeof data.chainId === 'number' ? `Chain ${data.chainId}` : undefined);

        return {
          label: 'Agent Sent Crypto.',
          text: network ? `${amt ?? '?'} ETH sent to ${to} on ${network}` : `${amt ?? '?'} ETH sent to ${to}`,
        };
      }

      const reason = (typeof data.reason === 'string' && data.reason.trim()) || extractTextFromOutput(chip.output) || 'Declined.';
      return {
        label: 'Agent Declined.',
        text: reason,
      };
    }

    // Fallbacks (legacy text or unknown shape)
    const text = extractTextFromOutput(chip.output);
    return {
      label: 'Agent Result',
      text: text ?? '',
    };
  },

  error: (chip: ChipLike) => {
    return {
      label: 'Agent Error',
      text: chip.errorText ?? 'An unexpected error occurred',
    };
  },
};
