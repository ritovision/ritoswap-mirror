/* dapp/components/utilities/chatBot/ToolActivity/catalog/presenters/send_crypto.presenter.ts */
import type { ChipLike, ToolChipPresenter } from '../types';
import type { ToolInputMap } from '@lib/mcp/generated/tool-catalog-types';

type JsonContent = { type: string; text?: string; data?: unknown };
type ToolWireResult = { content?: JsonContent[]; isError?: boolean };

type SendCryptoInput = ToolInputMap['send_crypto_to_signed_in_user'];
type SendCryptoPayload = {
  amountEth?: number;
  to?: string;
  network?: string;
  networkName?: string;
  chainId?: number;
};

function extractJsonFromOutput(output: unknown): unknown | undefined {
  const res = output as ToolWireResult;
  const json = Array.isArray(res?.content)
    ? res!.content.find((c) => c?.type === 'json')
    : undefined;
  return json?.data;
}

function extractTextFromOutput(output: unknown): string | undefined {
  const res = output as ToolWireResult;
  const texts = Array.isArray(res?.content)
    ? res!.content
        .filter((c) => c?.type === 'text' && typeof c.text === 'string')
        .map((c) => (c!.text as string).trim())
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

function maybeWalletFriendly(errorText?: string): string | undefined {
  if (!errorText) return undefined;
  const walletLike = /(wallet|connect|signed?\s*in|jwt|address|owner)/i.test(errorText);
  return walletLike ? 'Your wallet must be connected to use this' : undefined;
}

export const presenter: ToolChipPresenter<'send_crypto_to_signed_in_user'> = {
  toolName: 'send_crypto_to_signed_in_user',

  // Label-only pending (no body)
  pending: (_chip: ChipLike) => {
    // You asked for no body on pending; keep label simple and verb-first.
    return { label: 'Sending Crypto', text: '' };
  },

  success: (chip: ChipLike) => {
    const json = extractJsonFromOutput(chip.output);

    if (json && typeof json === 'object') {
      const data = json as Partial<SendCryptoPayload>;
      const input = chip.input as (SendCryptoInput | undefined);

      const amt =
        formatEthAmount(data.amountEth) ||
        formatEthAmount(input?.amountEth) ||
        '?';

      const to =
        shortAddr(data.to) ||
        (typeof data.to === 'string' ? data.to : 'recipient');

      const network =
        normalizeNetworkName(data.network) ||
        normalizeNetworkName(data.networkName) ||
        (typeof data.chainId === 'number' ? `Chain ${data.chainId}` : undefined);

      return {
        label: 'Sent Crypto.',
        text: network ? `${amt} ETH sent to ${to} on ${network}` : `${amt} ETH sent to ${to}`,
      };
    }

    // Fallbacks (legacy text or unknown shape)
    const text = extractTextFromOutput(chip.output);
    return {
      label: 'Sent Crypto.',
      text: text ?? '',
    };
  },

  error: (chip: ChipLike) => {
    const friendly = maybeWalletFriendly(chip.errorText);
    return {
      label: 'Failed to Send Crypto.',
      text: friendly ?? chip.errorText ?? 'An unexpected error occurred',
    };
  },
};
