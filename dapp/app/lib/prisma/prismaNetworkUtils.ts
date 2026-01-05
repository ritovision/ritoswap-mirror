// app/lib/prisma/prismaNetworkUtils.ts

import { PrismaClient } from '@prisma/client'
import {
  CHAIN_IDS,
  Chain,
  type ChainType,
  getActiveChain,
} from '@/app/config/chain'
import { nodeConfig } from '@config/node.env'

// Re-export so existing imports in routes keep working
export { getChainConfig } from '@config/chain'

/**
 * Singleton Prisma client (safe for Next dev reloads).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (!nodeConfig.isProduction) {
  globalForPrisma.prisma = prisma
}

/**
 * If you ever keep a single table called `Token` in your schema (delegate `token`),
 * this generic name will be used as a fallback. Today your schema exposes:
 *   tokenEthereum, tokenRitonet, tokenSepolia
 */
const TOKEN_MODEL_GENERIC = 'token' as const

/**
 * Map the active chain to your per-chain Prisma delegate name.
 * Adjust these if your Prisma model names change.
 */
function tokenDelegateFor(active: ChainType): string {
  switch (active) {
    case 'ethereum':
      return 'tokenEthereum'
    case 'sepolia':
      return 'tokenSepolia'
    case 'ritonet':
      return 'tokenRitonet'
    default:
      return TOKEN_MODEL_GENERIC
  }
}

/** Minimal delegate surface used by callers. */
interface TokenModelDelegate {
  findUnique: (args: unknown) => Promise<{ used?: boolean } | null> | ({ used?: boolean } | null)
  findMany: (args?: unknown) => Promise<unknown[]> | unknown[]
}

/** Safe dynamic property access without `any`. */
function getProp(obj: unknown, key: string): unknown {
  return obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined
}

/** Narrow to a Prisma-like delegate by checking for `findMany`. */
function isTokenModelDelegate(x: unknown): x is TokenModelDelegate {
  return typeof (x as { findMany?: unknown })?.findMany === 'function'
}

/**
 * Return the correct Prisma delegate for the token model,
 * automatically selecting the per-chain table based on the active chain.
 *
 * Example:
 *   const Token = getTokenModel()
 *   await Token.findUnique({ where: { tokenId: 123 } })
 */
export function getTokenModel(client: PrismaClient = prisma): TokenModelDelegate {
  const active = getActiveChain() // 'ethereum' | 'sepolia' | 'ritonet'
  const preferred = tokenDelegateFor(active)

  // Try chain-specific delegate first
  let model: unknown = getProp(client, preferred)

  // Fallback to generic `token` if present
  if (!isTokenModelDelegate(model)) {
    model = getProp(client, TOKEN_MODEL_GENERIC)
  }

  if (!isTokenModelDelegate(model)) {
    const entries = client as unknown as Record<string, unknown>
    const candidates = Object.keys(entries)
      .filter((k) => typeof (entries[k] as { findMany?: unknown })?.findMany === 'function')
      .sort()
    throw new Error(
      `[prismaNetworkUtils] Token model not found for active chain "${active}". ` +
        `Tried "${preferred}"${TOKEN_MODEL_GENERIC ? ` and "${TOKEN_MODEL_GENERIC}"` : ''}. ` +
        `Available delegates: ${candidates.join(', ')}`
    )
  }

  return model
}

/**
 * Utility: resolve a numeric chain ID from either a ChainType (lowercase)
 * or an enum-style key from Chain (uppercase).
 */
export function getChainId(chain: ChainType | keyof typeof Chain): number {
  const chainMap = Chain as unknown as Record<string, ChainType>
  const key: ChainType = (chain in Chain ? chainMap[chain as string] : chain) as ChainType
  return CHAIN_IDS[key]
}

/** Convenience IDs (optional) */
export const ETHEREUM_ID = CHAIN_IDS[Chain.ETHEREUM]
export const SEPOLIA_ID = CHAIN_IDS[Chain.SEPOLIA]
export const RITONET_ID = CHAIN_IDS[Chain.RITONET]
