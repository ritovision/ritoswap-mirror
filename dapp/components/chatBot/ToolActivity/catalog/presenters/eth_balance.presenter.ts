// dapp/components/utilities/chatBot/ToolActivity/catalog/presenters/get_eth_balance.presenter.ts
import type { ChipLike, ToolChipPresenter } from '../types';
import type { ToolInputMap } from '@lib/mcp/generated/tool-catalog-types';

function getChainFromInput(input: unknown): string | undefined {
  try {
    const obj = input as { chain?: unknown; network?: unknown } | undefined;
    if (obj && typeof obj === 'object') {
      const val = typeof obj.chain === 'string' ? obj.chain : (typeof obj.network === 'string' ? obj.network : undefined);
      return val;
    }
  } catch {}
  return undefined;
}

type JsonContent = { type: string; text?: string; data?: unknown };
type ToolWireResult = { content?: JsonContent[]; isError?: boolean };

function extractJsonFromOutput(output: unknown): unknown | undefined {
  const res = output as ToolWireResult;
  const json = Array.isArray(res?.content) ? res.content.find((c) => c?.type === 'json') : undefined;
  return json?.data;
}

function extractTextFromOutput(output: unknown): string | undefined {
  const res = output as ToolWireResult;
  const texts = Array.isArray(res?.content)
    ? res.content
        .filter((c) => c?.type === 'text' && typeof c.text === 'string')
        .map((c) => String(c.text).trim())
    : [];
  return texts.length ? texts.join('\n') : undefined;
}

function maybeWalletFriendly(errorText?: string): string | undefined {
  if (!errorText) return undefined;
  const walletLike = /(wallet|connect|signed?\s*in|owner)/i.test(errorText);
  return walletLike ? 'Your wallet must be connected to use this' : undefined;
}

type BalanceJson = {
  symbol?: string;
  balanceEth?: string;
  chainName?: string;
  chain?: string;
};

export const presenter: (ToolChipPresenter<'get_eth_balance'> & { __types?: ToolInputMap }) = {
  toolName: 'get_eth_balance',

  // Label-only pending; empty text satisfies the type so no body renders
  pending: (chip: ChipLike) => {
    const _chain = getChainFromInput(chip.input) || 'mainnet'; // reserved for future copy adjustments
    return {
      label: 'Fetching Balance',
      text: '',
    };
  },

  success: (chip: ChipLike) => {
    const json = extractJsonFromOutput(chip.output);
    if (json && typeof json === 'object') {
      const j = json as BalanceJson;
      const sym = typeof j.symbol === 'string' ? j.symbol : 'ETH';
      const amt = typeof j.balanceEth === 'string' ? j.balanceEth : undefined;
      const chainName = typeof j.chainName === 'string'
        ? j.chainName
        : (typeof j.chain === 'string' ? j.chain : 'mainnet');
      if (amt) {
        return {
          label: 'Fetched Balance.',
          text: `${amt} ${sym} on ${chainName}`,
        };
      }
    }

    // Fallback to text if JSON missing (legacy tools)
    const text = extractTextFromOutput(chip.output);
    return {
      label: 'Fetched Balance.',
      text: text ?? '',
    };
  },

  error: (chip: ChipLike) => {
    const friendly = maybeWalletFriendly(chip.errorText);
    return {
      label: 'Failed to Fetch Balance.',
      text: friendly ?? chip.errorText ?? 'An unexpected error occurred',
    };
  },
};
