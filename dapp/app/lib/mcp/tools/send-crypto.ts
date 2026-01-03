/* dapp/app/lib/mcp/tools/send-crypto.ts
 *
 * JWT-gated native ETH sender (active network only).
 * - LLM chooses ONLY the amount (0.1–0.3); no address or network inputs allowed.
 * - Recipient address comes from the authenticated JWT (server plumbing) ONLY.
 * - Uses AI_PRIVATE_KEY as the sender account.
 * - Uses the active network's RPC (Alchemy for public chains, local RPC for ritonet).
 * - Preflight: check sender balance covers amount + estimated gas.
 * - Waits for transaction receipt (no extra confirmations) and returns a chain-aware explorer URL.
 *
 * NOTE: This tool is conditionally registered only when AI_PRIVATE_KEY is set (see tools/index.ts).
 */

import { createLogger } from '@logger';
import type { Tool } from '@schemas/domain/tool';
import { createTool } from './types';
import { isValidAddress, CHAIN_IDS, formatChainName } from '../utils/chains';
import type { SupportedChain } from '@schemas/domain/chains';
import { aiServerConfig } from '@config/ai.server';
import { publicEnv } from '@config/public.env';
import { fail, errorResultShape } from './tool-errors';

// viem utilities
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  formatEther as viemFormatEther,
} from 'viem';
import type { Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// Active chain config helper (use your project’s active network config)
import { getChainConfig } from '@config/chain';

// ⬇️ crypto quota helpers
import {
  recordCryptoSpend,
  isCryptoQuotaFeatureActive,
} from '@/app/lib/quotas/crypto-quota';

const logger = createLogger('send-crypto-tool');

// Strict input schema: only amountEth allowed, 0.1–0.3 inclusive.
const InputSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    amountEth: {
      type: 'number',
      description: 'Amount of native token to send (ETH). Allowed range: 0.1–0.3 (inclusive).',
      minimum: 0.1,
      maximum: 0.3,
    },
  },
  required: ['amountEth'],
};

/** Normalize 0x-address string (case-insensitive) */
function asAddr(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return isValidAddress(s) ? (s.toLowerCase() as `0x${string}`) : null;
}

function getPath(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur && typeof cur === 'object' && key in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return cur;
}

/**
 * Extract the JWT-bound user address from server-injected tool args.
 * We intentionally DO NOT accept a plain top-level "address" from the model.
 * Expected injection: args.__jwt.address (or a few common alternates).
 */
function extractJwtAddress(args: Record<string, unknown> | undefined): string | null {
  const a = args ?? {};

  const candidates: unknown[] = [
    getPath(a, ['__jwt', 'address']), getPath(a, ['__jwt', 'addr']), getPath(a, ['__jwt', 'sub']),
    getPath(a, ['jwt', 'address']), getPath(a, ['jwt', 'addr']), getPath(a, ['jwt', 'sub']), getPath(a, ['jwtAddress']),
    getPath(a, ['__meta', 'jwt', 'address']), getPath(a, ['__meta', 'jwt', 'sub']),
    getPath(a, ['user', 'address']), getPath(a, ['user', 'addr']), getPath(a, ['user', 'sub']),
    getPath(a, ['siwe', 'address']), getPath(a, ['siwe', 'addr']),
    getPath(a, ['session', 'address']),
    getPath(a, ['auth', 'address']),
    getPath(a, ['sub']),
  ];

  for (const c of candidates) {
    const addr = asAddr(c);
    if (addr) return addr;
  }

  try {
    const topKeys = Object.keys(a as Record<string, unknown>);
    const jwtObj = getPath(a, ['__jwt']);
    const hasJwt = jwtObj && typeof jwtObj === 'object' ? Object.keys(jwtObj as Record<string, unknown>) : null;
    const jwtAltObj = getPath(a, ['jwt']);
    const hasJwtAlt = jwtAltObj && typeof jwtAltObj === 'object' ? Object.keys(jwtAltObj as Record<string, unknown>) : null;
    logger.warn('JWT address not found in tool args', { topKeys, __jwt_keys: hasJwt, jwt_keys: hasJwtAlt });
  } catch {
    /* ignore */
  }

  return null;
}

// Reverse-lookup chain key from id using CHAIN_IDS
function chainKeyFromId(id: number): SupportedChain | null {
  for (const [key, val] of Object.entries(CHAIN_IDS)) {
    if (val === id) return key as SupportedChain;
  }
  return null;
}

// Map chainId → explorer base URL (Etherscan family + Blockscout for ritonet)
function explorerBaseFor(chainId: number): string | null {
  const bases: Record<number, string> = {
    [CHAIN_IDS.mainnet]: 'https://etherscan.io',
    [CHAIN_IDS.sepolia]: 'https://sepolia.etherscan.io',
    [CHAIN_IDS.polygon]: 'https://polygonscan.com',
    [CHAIN_IDS.arbitrum]: 'https://arbiscan.io',
    [CHAIN_IDS.avalanche]: 'https://snowtrace.io',
    [CHAIN_IDS.base]: 'https://basescan.org',
    [CHAIN_IDS.optimism]: 'https://optimistic.etherscan.io',
    [CHAIN_IDS.fantom]: 'https://ftmscan.com',
  };

  if (chainId === CHAIN_IDS.ritonet) {
    const raw = publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_EXPLORER_URL || '';
    if (raw) return raw.replace(/\/+$/, '');
    return null;
  }

  return bases[chainId] ?? null;
}

// --- formatting helpers for the LLM-friendly text ---
function shortAddr(addr?: string): string | null {
  if (!addr || typeof addr !== 'string') return null;
  return /^0x[a-fA-F0-9]{40}$/.test(addr)
    ? `${addr.slice(0, 6)}…${addr.slice(-4)}`
    : addr;
}

function formatEthAmount(val: number | string | undefined): string {
  const n = typeof val === 'number' ? val : typeof val === 'string' ? Number(val) : NaN;
  if (!Number.isFinite(n)) return '?';
  let s = n.toFixed(6).replace(/(?:\.0+|(\.\d*?[1-9]))0+$/, '$1');
  if (s.endsWith('.')) s = s.slice(0, -1);
  if (s.startsWith('0.')) s = s.slice(1); // ".123"
  return s;
}

function normalizeNetworkName(n?: unknown): string | undefined {
  if (!n) return undefined;
  if (typeof n === 'string' && n.trim().length > 0) {
    const s = n.trim();
    if (/[A-Z]/.test(s)) return s; // keep "Sepolia", "RitoNet"
    return s[0].toUpperCase() + s.slice(1);
  }
  if (typeof n === 'number') return `Chain ${n}`;
  return undefined;
}

type Params = { amountEth: number };
type ActiveChainLike = {
  rpcUrl?: string;
  chainId?: number;
  chain?: { id?: number; chainId?: number };
};

const tool: Tool<Params> = {
  name: 'send_crypto_to_signed_in_user',
  description:
    'Send native ETH on the active network to the address from the JWT. ' +
    'Model may only choose an amount between 0.1 and 0.3 ETH. Waits for inclusion and returns an explorer URL.',
  requiresJwt: true, // 🔒 server-side gate (hidden from wire)
  inputSchema: InputSchema,

  async handler(params: Params) {
    // ——— Early precondition checks (throw to mark chip ✖) ———
    const priv = (aiServerConfig.secrets as Record<string, unknown>)['aiPrivateKey'] as string | undefined;
    if (!priv) fail('send-crypto is unavailable: AI_PRIVATE_KEY not configured.');

    const amountEth = Number(params?.amountEth);
    if (!Number.isFinite(amountEth) || amountEth < 0.1 || amountEth > 0.3) {
      fail('amountEth must be between 0.1 and 0.3 ETH (inclusive).');
    }

    // Resolve recipient from JWT-injected context (no fallbacks)
    const to = extractJwtAddress(params as unknown as Record<string, unknown>);
    if (!to) {
      fail('No JWT-bound address available. Ensure the request is authenticated and the dispatcher injects __jwt.address.');
    }
    // ————————————————————————————————————————————————————————————————

    try {
      // Resolve active RPC + chainId from your chain config
      const activeChain = ((getChainConfig as unknown as () => unknown)() ?? {}) as Partial<ActiveChainLike>;
      const rpcUrl = typeof activeChain.rpcUrl === 'string' ? activeChain.rpcUrl : undefined;
      const chainId: number | undefined =
        typeof activeChain.chainId === 'number'
          ? activeChain.chainId
          : typeof activeChain.chain?.id === 'number'
          ? activeChain.chain.id
          : typeof activeChain.chain?.chainId === 'number'
          ? activeChain.chain.chainId
          : undefined;

      if (!rpcUrl) return errorResultShape('Active chain RPC URL not available.');

      // Wallet & public clients
      const account = privateKeyToAccount(priv as `0x${string}`);
      const walletClient = createWalletClient({ account, transport: http(rpcUrl) });
      const publicClient = createPublicClient({ transport: http(rpcUrl) });

      const chainParam = typeof chainId === 'number' ? ({ id: chainId } as unknown as Chain) : undefined;

      // ---------- Preflight: ensure sender can cover amount + estimated gas ----------
      const value = parseEther(amountEth.toString());

      const [senderBal, estGas, gasPrice] = await Promise.all([
        publicClient.getBalance({ address: account.address }),
        publicClient.estimateGas({
          account: account.address,
          to: to as `0x${string}`,
          value,
          chain: chainParam,
        } as Parameters<typeof publicClient.estimateGas>[0]),
        publicClient.getGasPrice(),
      ]);

      const estFee = gasPrice * estGas;
      const needed = value + estFee;

      if (senderBal < needed) {
        const haveEth = viemFormatEther(senderBal);
        const needEth = viemFormatEther(needed);
        const gasEth = viemFormatEther(estFee);
        logger.warn('Insufficient balance for amount + gas', {
          from: account.address,
          to,
          amountEth,
          senderBal: senderBal.toString(),
          estGas: estGas.toString(),
          gasPrice: gasPrice.toString(),
          estFee: estFee.toString(),
        });
        return errorResultShape(
          `Insufficient balance: need ~${needEth} ETH (amount ${amountEth} + gas ~${gasEth}), have ${haveEth} ETH.`
        );
      }
      // ------------------------------------------------------------------------------

      // Send tx
      const hash = await walletClient.sendTransaction({
        to: to as `0x${string}`,
        value,
        chain: chainParam,
      });

      // Wait for receipt (no extra confirmations)
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 90_000,
      });

      const finalChainId = chainId ?? (await walletClient.getChainId());
      const status = receipt.status === 'success' ? 'success' : 'failed';

      const explorerBase = explorerBaseFor(finalChainId);
      const explorerUrl = explorerBase ? `${explorerBase}/tx/${hash}` : null;

      const key = chainKeyFromId(finalChainId);
      const network = key ? formatChainName(key) : `Chain ${finalChainId}`;

      logger.info('Native transfer result', {
        to,
        from: account.address,
        amountEth,
        chainId: finalChainId,
        hash,
        status,
      });

      // ⬇️ record usage after success
      try {
        if (isCryptoQuotaFeatureActive()) {
          await recordCryptoSpend(to, amountEth);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error('crypto_quota_accounting_failed', { error: msg });
      }

      // Build the JSON payload (unchanged data shape)
      const payload = {
        status, // 'success' | 'failed'
        hash,
        explorerUrl,
        from: account.address,
        to,
        amountEth,
        chainId: finalChainId,
        network,
        receipt: {
          blockNumber: (receipt as { blockNumber?: { toString?: () => string } | unknown }).blockNumber?.toString?.() ?? receipt.blockNumber,
          gasUsed: (receipt as { gasUsed?: { toString?: () => string } | unknown }).gasUsed?.toString?.() ?? receipt.gasUsed,
          cumulativeGasUsed:
            (receipt as { cumulativeGasUsed?: { toString?: () => string } | unknown }).cumulativeGasUsed?.toString?.() ??
            receipt.cumulativeGasUsed,
        },
      };

      // Human-readable line for the LLM
      const amtLabel = formatEthAmount(amountEth);
      const toLabel = shortAddr(to) ?? to;
      const netLabel = normalizeNetworkName(network) ?? `Chain ${finalChainId}`;
      const text = `Sent Crypto.\n${amtLabel} ETH sent to ${toLabel} on ${netLabel}.\nExplorer: ${explorerUrl ?? 'unavailable'}`;

      // Return both text (for LLM) and json (for UI/presenters)
      return {
        content: [
          { type: 'text', text },
          { type: 'json', data: payload },
        ],
      };
    } catch (err) {
      logger.error('send-crypto failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return errorResultShape(err instanceof Error ? err.message : 'Failed to send transaction');
    }
  },
};

export default createTool(tool);
