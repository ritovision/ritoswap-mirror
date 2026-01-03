// dapp/app/lib/mcp/tools/mark-key-used.ts
//
// JWT-gated tool that marks a token as "used" for the ACTIVE chain.
// - Reads tokenId + address from server-injected JWT claims (no LLM-provided values).
// - Chooses the correct Prisma model automatically based on active chain.
// - Sets: used=true, usedBy=<jwt.address>, usedAt=<now>.
// - If already used, returns failure with details.
// - Verifies the write succeeded.

import { createLogger } from '@logger';
import type { Tool } from '../../../schemas/domain/tool';
import { createTool, jsonResult, textResult } from './types';
import { isValidAddress, formatChainName } from '../utils/chains';
import { prisma, getTokenModel } from '../../prisma/prismaNetworkUtils';
import { getActiveChain } from '@config/chain';
import { isSupportedChain, type SupportedChain } from '@schemas/domain/chains';
import { fail, errorResultShape } from './tool-errors';

const logger = createLogger('mark-key-used');

// No input; everything comes from JWT.
const InputSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {},
};

type Params = Record<string, unknown>;

function asObj(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined;
}

function getString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function getNumberLike(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function extractJwt(params: Params) {
  const root = asObj(params) ?? {};
  const jwt = asObj(root.__jwt) ?? asObj(root.jwt);

  const address =
    getString(jwt?.address) ??
    getString(root.jwtAddress) ??
    getString(root.sub) ??
    getString(asObj(root.__jwt)?.sub);

  const tokenId = getNumberLike(jwt?.tokenId ?? root.tokenId);

  return { address, tokenId };
}

function shortAddr(addr: string): string {
  return /^0x[a-fA-F0-9]{40}$/.test(addr) ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

// Map app "active chain" → SupportedChain expected by utils (ethereum → mainnet)
function toSupportedChain(chain: 'ethereum' | 'sepolia' | 'ritonet'): SupportedChain {
  const mapped = chain === 'ethereum' ? 'mainnet' : chain;
  // Type-safe guard in case of future additions
  return isSupportedChain(mapped) ? (mapped as SupportedChain) : 'mainnet';
}

interface TokenModel {
  updateMany(args: {
    where: { tokenId: number; used: boolean };
    data: { used: boolean; usedBy: string; usedAt: Date };
  }): Promise<{ count: number }>;
  findUnique(args: {
    where: { tokenId: number };
  }): Promise<
    | {
        used?: boolean;
        usedBy?: string | null;
        usedAt?: Date | string | null;
      }
    | null
  >;
}

const tool: Tool<Params> = {
  name: 'mark_key_used',
  description:
    'Mark the JWT-owned key as used for the active chain. Reads tokenId and address from JWT and records usedBy/usedAt.',
  requiresJwt: true, // 🔒 per-tool gate
  inputSchema: InputSchema,

  async handler(params: Params) {
    try {
      const { address, tokenId } = extractJwt(params);

      // ✅ Fail fast on missing/invalid JWT preconditions (so chips show ✖)
      if (!address || !isValidAddress(address)) {
        fail('Not signed in');
      }
      if (!Number.isFinite(tokenId)) {
        fail('Missing or invalid tokenId for the signed-in user');
      }

      const active = getActiveChain(); // 'ethereum' | 'sepolia' | 'ritonet'
      const canonical = toSupportedChain(active); // 'mainnet' | 'sepolia' | 'ritonet' | ...
      const chainName = formatChainName(canonical);
      const Token = getTokenModel(prisma) as unknown as TokenModel; // narrow external typing locally

      const now = new Date();

      // Atomic check-and-set using updateMany where used=false
      const updateRes = await Token.updateMany({
        where: { tokenId: tokenId as number, used: false },
        data: { used: true, usedBy: address.toLowerCase(), usedAt: now },
      });

      if (updateRes.count === 0) {
        // Either not found, or already used. Disambiguate:
        const existing = await Token.findUnique({ where: { tokenId: tokenId as number } });
        if (!existing) {
          logger.warn('Token not found for active chain', { tokenId, active });
          return errorResultShape(`Token ${tokenId} not found on ${chainName}.`);
        }
        if (existing.used) {
          return errorResultShape(
            `Token #${tokenId} is already used on ${chainName}` +
              (existing.usedBy ? ` by ${shortAddr(existing.usedBy)}` : '') +
              (existing.usedAt ? ` at ${new Date(existing.usedAt).toISOString()}` : ''),
          );
        }
        // Edge case: present but not used, yet updateMany matched 0 rows.
        return errorResultShape('Failed to mark token as used (unexpected state).');
      }

      // Verify write
      const record = await Token.findUnique({ where: { tokenId: tokenId as number } });
      if (!record?.used) {
        return errorResultShape('Verification failed: token not marked as used.');
      }

      const usedAtIso =
        record.usedAt instanceof Date
          ? record.usedAt.toISOString()
          : new Date(record.usedAt as string).toISOString();

      logger.info('Token marked as used', {
        tokenId,
        address: address.toLowerCase(),
        usedAt: usedAtIso,
        active,
        canonical,
      });

      // 👉 Human-readable one-liner for the LLM (and logs)
      const human = `Marked key #${tokenId} as used on ${chainName} by ${shortAddr(
        address.toLowerCase(),
      )} at ${usedAtIso}`;

      const text = textResult(human);

      // 👉 Structured JSON for UI/presenters
      const json = jsonResult({
        status: 'success',
        tokenId,
        address: address.toLowerCase(),
        chain: active,            // app's chain id (e.g., 'ethereum')
        chainCanonical: canonical, // normalized for RPC utils (e.g., 'mainnet')
        chainName,                // human name (e.g., 'Ethereum')
        usedAt: usedAtIso,
      });

      return { content: [...text.content, ...json.content] };
    } catch (err) {
      logger.error('mark_key_used failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      // Ensure SSE payload carries isError: true so chip shows ✖
      return errorResultShape(err instanceof Error ? err.message : 'Failed to mark key as used');
    }
  },
};

export default createTool(tool);
