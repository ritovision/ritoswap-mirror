/*
// dapp/components/utilities/chatBot/ToolActivity/catalog/presenters/keynft_read.presenter.ts
*/
import type { ChipLike, ToolChipPresenter } from '../types';
import { publicConfig, publicEnv } from '@/app/config/public.env';

type JsonContent = { type: string; text?: string; data?: unknown };
type ToolWireResult = { content?: JsonContent[]; isError?: boolean };

type TokenMeta = {
  tokenId?: string | number;
  colors?: { backgroundColor?: string; keyColor?: string };
};

function asRecord(obj: unknown): Record<string, unknown> | undefined {
  return obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : undefined;
}

function extractJsonFromOutput(output: unknown): unknown | undefined {
  const res = output as ToolWireResult;
  const content = Array.isArray(res?.content) ? res.content : undefined;
  const json = content?.find((c) => c?.type === 'json');
  return json?.data;
}
function extractTextFromOutput(output: unknown): string | undefined {
  const res = output as ToolWireResult;
  const content = Array.isArray(res?.content) ? res.content : undefined;
  const texts = content
    ? content
        .filter((c): c is JsonContent & { text: string } => c?.type === 'text' && typeof c.text === 'string')
        .map((c) => c.text.trim())
    : [];
  return texts.length ? texts.join('\n') : undefined;
}
function shortAddr(addr?: string): string | undefined {
  if (!addr || typeof addr !== 'string') return undefined;
  return /^0x[a-fA-F0-9]{40}$/.test(addr) ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : undefined;
}
function activeNetworkName(): string {
  switch (publicConfig.activeChain) {
    case 'ethereum': return 'Ethereum';
    case 'sepolia': return 'Sepolia';
    case 'ritonet': return publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME || 'RitoNet';
    default: return publicConfig.activeChain;
  }
}
function formatIntegerLike(val: unknown): string | undefined {
  const s =
    typeof val === 'string' ? val :
    typeof val === 'number' ? Math.trunc(val).toString() :
    typeof val === 'bigint' ? val.toString() : undefined;
  if (!s) return undefined;
  return /^\d+$/.test(s) ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : s;
}
function fmtColor(v?: unknown): string {
  if (!v || typeof v !== 'string') return 'N/A';
  return v.startsWith('#') ? v : `#${v}`;
}
function maybeWalletFriendly(errorText?: string): string | undefined {
  if (!errorText) return undefined;
  const walletLike = /(wallet|connect|signed?\s*in|owner)/i.test(errorText);
  return walletLike ? 'Your wallet must be connected to use this' : undefined;
}

export const presenter: ToolChipPresenter<'key_nft_read'> = {
  toolName: 'key_nft_read',

  pending: (chip: ChipLike) => {
    const input = chip.input as { action?: string; owner?: string; tokenId?: string | number } | undefined;
    const action = input?.action;
    const owner = shortAddr(input?.owner);
    const tokenId = input?.tokenId;
    const net = activeNetworkName();

    switch (action) {
      case 'get_key_nft_balance': return { label: 'Checking Key Balance…', text: owner ? `${owner} on ${net}` : `Network: ${net}` };
      case 'get_key_nft_collection_info': return { label: 'Reading collection info…', text: `Network: ${net}` };
      case 'get_key_nft_total_supply': return { label: 'Fetching Key NFT total supply', text: '' };
      case 'get_key_nft_tokens_of_owner': return { label: `Listing Owner Tokens${owner ? ` for ${owner}` : ''}`, text: '' };
      case 'get_key_nft_token_of_owner': return { label: `Checking Key Ownership${owner ? ` for ${owner}` : ''}`, text: '' };
      case 'get_key_nft_token_metadata': return { label: tokenId ? `Fetching Token Metadata for #${tokenId}` : `Fetching Token Metadata`, text: '' };
      case 'get_key_nft_holders': return { label: 'Listing Key Holders', text: '' };
      case 'get_key_nft_summary_for_owner': return { label: `Building Owner Summary${owner ? ` for ${owner}` : ''}`, text: '' };
      default: return { label: 'Running key_nft_read…', text: '' };
    }
  },

  success: (chip: ChipLike) => {
    const input = chip.input as { action?: string } | undefined;
    const action = input?.action;
    const json = extractJsonFromOutput(chip.output);
    const text = extractTextFromOutput(chip.output);
    const data = asRecord(json);
    const net =
      typeof (data?.['networkName']) === 'string'
        ? (data?.['networkName'] as string)
        : activeNetworkName();

    switch (action) {
      case 'get_key_nft_balance': {
        if (data) {
          const balance = formatIntegerLike(data['balance']);
          const owner = shortAddr(typeof data['owner'] === 'string' ? (data['owner'] as string) : undefined);
          const contract = shortAddr(typeof data['address'] === 'string' ? (data['address'] as string) : undefined);
          if (balance) {
            const plural = balance === '1' ? 'key' : 'keys';
            const who = owner ? `${owner} has` : 'Balance:';
            const at = contract ? ` (${contract})` : '';
            return { label: 'Fetched Key Balance.', text: `${who} ${balance} ${plural} on ${net}${at}` };
          }
        }
        return { label: 'Fetched Key Balance.', text: text || 'No additional details returned.' };
      }

      case 'get_key_nft_collection_info': {
        if (data) {
          const name = typeof data['name'] === 'string' ? (data['name'] as string) : undefined;
          const symbol = typeof data['symbol'] === 'string' ? (data['symbol'] as string) : undefined;
          const addr = shortAddr(typeof data['address'] === 'string' ? (data['address'] as string) : undefined);
          if (name && symbol) {
            const at = addr ? ` — ${addr}` : '';
            return { label: 'Fetched Collection Info.', text: `${name} (${symbol}) on ${net}${at}` };
          }
        }
        return { label: 'Fetched Collection Info.', text: text || 'No additional details returned.' };
      }

      case 'get_key_nft_total_supply': {
        if (data) {
          const supply = formatIntegerLike(data['totalSupply']);
          const addr = shortAddr(typeof data['address'] === 'string' ? (data['address'] as string) : undefined);
          if (supply) {
            return { label: 'Fetched Key NFT Total Supply.', text: `Total supply on ${net}: ${supply}${addr ? ` (${addr})` : ''}` };
          }
        }
        return { label: 'Fetched Key NFT Total Supply.', text: text || `total supply on ${net}: (unknown)` };
      }

      case 'get_key_nft_tokens_of_owner': {
        if (data) {
          const owner = shortAddr(typeof data['owner'] === 'string' ? (data['owner'] as string) : undefined) || 'Owner';
          const addr = shortAddr(typeof data['address'] === 'string' ? (data['address'] as string) : undefined);
          const idsRaw = data['tokenIds'];
          const ids = Array.isArray(idsRaw) ? idsRaw : [];
          const total = Number.isFinite(data['total'] as number) ? Number(data['total']) : ids.length;
          const countPart = `${total} token${total === 1 ? '' : 's'}`;
          const list = (() => {
            const strs = ids.map((x: unknown) => String(x));
            if (strs.length === 0) return 'none';
            if (strs.length <= 5) return strs.map((id: string) => `#${id}`).join(', ');
            return `${strs.slice(0, 5).map((id: string) => `#${id}`).join(', ')} +${strs.length - 5} more`;
          })();
          return { label: 'Fetched Owner Tokens.', text: `${owner} holds ${countPart} on ${net}${addr ? ` (${addr})` : ''}: ${list}` };
        }
        return { label: 'Fetched Owner Tokens.', text: text ?? '' };
      }

      case 'get_key_nft_token_of_owner': {
        if (data) {
          const owner = shortAddr(typeof data['owner'] === 'string' ? (data['owner'] as string) : undefined) || 'Owner';
          const has = Boolean(data['hasToken']);
          const tokenId = data['tokenId'];
          const idPart = typeof tokenId === 'string' && tokenId !== '' ? ` #${tokenId}` : '';
          const contract = shortAddr(typeof data['address'] === 'string' ? (data['address'] as string) : undefined);
          const at = contract ? ` (${contract})` : '';
          return { label: 'Fetched Key Ownership.', text: has ? `${owner} has key${idPart} on ${net}${at}` : `${owner} has no key on ${net}${at}` };
        }
        return { label: 'Fetched Key Ownership.', text: text ?? '' };
      }

      case 'get_key_nft_token_metadata': {
        if (data) {
          const idRaw = data['tokenId'];
          const id = typeof idRaw === 'string' ? idRaw : typeof idRaw === 'number' ? String(idRaw) : undefined;
          const addr = shortAddr(typeof data['address'] === 'string' ? (data['address'] as string) : undefined);
          const colorsRaw = data['colors'];
          const colors = colorsRaw && typeof colorsRaw === 'object' ? (colorsRaw as TokenMeta['colors']) : undefined;
          const bg = fmtColor(colors?.backgroundColor);
          const key = fmtColor(colors?.keyColor);
          return { label: 'Fetched Token Metadata.', text: `Token #${id ?? '?'} on ${net} — Properties: BG ${bg}, KeyColor ${key}${addr ? ` (${addr})` : ''}` };
        }
        return { label: 'Fetched Token Metadata.', text: text ?? '' };
      }

      case 'get_key_nft_holders': {
        if (data) {
          const totalHolders = formatIntegerLike(data['totalHolders']) ?? '?';
          const addr = shortAddr(typeof data['address'] === 'string' ? (data['address'] as string) : undefined);
          return { label: 'Fetched Key Holders.', text: `${totalHolders} holders on ${net}${addr ? ` (${addr})` : ''}` };
        }
        return { label: 'Fetched Key Holders.', text: text ?? `${'?'} holders on ${net}` };
      }

      case 'get_key_nft_summary_for_owner': {
        if (data) {
          const ownerShort = shortAddr(typeof data['owner'] === 'string' ? (data['owner'] as string) : undefined) || 'Owner';
          const tokenIdsRaw = data['tokenIds'];
          const tokenIds = Array.isArray(tokenIdsRaw) ? tokenIdsRaw : [];
          const total = tokenIds.length;
          const addr = shortAddr(typeof data['address'] === 'string' ? (data['address'] as string) : undefined);
          const tokensRaw = data['tokens'];
          const tokens = Array.isArray(tokensRaw) ? (tokensRaw as unknown[]) : [];
          const first = tokens[0] as TokenMeta | undefined;
          let body = `${ownerShort} has ${total} token${total === 1 ? '' : 's'} on ${net}${addr ? ` (${addr})` : ''}`;
          if (first && first.tokenId !== undefined) {
            const bg = fmtColor(first.colors?.backgroundColor);
            const key = fmtColor(first.colors?.keyColor);
            body += `\nProperties: TokenID #${first.tokenId}, BG ${bg}, KeyColor ${key}`;
          }
          return { label: 'Fetched Owner Summary.', text: body };
        }
        return { label: 'Fetched Owner Summary.', text: text ?? '' };
      }

      default:
        return { label: 'Done.', text: text ?? '' };
    }
  },

  error: (chip: ChipLike) => {
    const friendly = maybeWalletFriendly(chip.errorText);
    return { label: 'key_nft_read failed', text: friendly ?? chip.errorText ?? 'An unexpected error occurred' };
  },
};
