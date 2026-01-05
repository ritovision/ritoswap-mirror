/* app/lib/quotas/crypto-quota.ts */
import 'server-only';
import { createLogger } from '@logger';
import { serverConfig } from '@config/server.env';
import { aiServerConfig } from '@config/ai.server';
import { getChainConfig } from '@config/chain';
import { CHAIN_IDS } from '@/app/lib/mcp/utils/chains';
import { getStateClient, isStateServiceEnabled } from '@/app/lib/state/client';
import type { QuotaWindow } from '@/app/lib/state/types';

const logger = createLogger('crypto-quota');

const isStateStoreAvailable = () =>
  serverConfig.stateService.isActive && isStateServiceEnabled();

// ---- Feature switch (ON by default) ----
const QUOTA_ENABLED = (() => {
  // AI_CRYPTO_QUOTA default true (see ai.server.ts)
  return Boolean(aiServerConfig.cryptoQuota.enabled);
})();

/**
 * We store ETH amounts as integer micro-ETH (µETH) to keep within 64-bit range and
 * avoid floating math. 1 ETH = 1,000,000 µETH.
 */
const SCALE = 1_000_000;
const toMicro = (eth: number) => Math.max(0, Math.ceil(eth * SCALE));
const fromMicro = (u: number) => u / SCALE;

type Window = QuotaWindow; // values in µETH

// Key space (scoped to the active network only)
const PREFIX = 'crypto:quota';

// Resolves the active network "key" from chainId using CHAIN_IDS
function getActiveNetworkKey(): string {
  const active = (getChainConfig as unknown as () => unknown)();
  const a = active as { chainId?: unknown; chain?: { id?: unknown; chainId?: unknown } };

  const idTop = typeof a.chainId === 'number' ? a.chainId : undefined;
  const idChain = typeof a.chain?.id === 'number' ? a.chain.id : undefined;
  const idChainAlt = typeof a.chain?.chainId === 'number' ? a.chain.chainId : undefined;

  const chainId: number | undefined = idTop ?? idChain ?? idChainAlt;

  if (!chainId) return 'unknown';
  for (const [k, v] of Object.entries(CHAIN_IDS)) {
    if (v === chainId) return k;
  }
  return `chain-${chainId}`;
}

function keysFor(network: string, address?: string) {
  const globalKey = `${PREFIX}:${network}:all`;
  const addrKey = address ? `${PREFIX}:${network}:addr:${address.toLowerCase()}` : null;
  return { globalKey, addrKey };
}

async function ensureWindow(k: string, limitMicro: number, durationSec: number): Promise<Window> {
  // Disabled: behave as unlimited "ephemeral"
  if (!QUOTA_ENABLED || !isStateStoreAvailable()) {
    const now = Math.floor(Date.now() / 1000);
    return { limit: Number.MAX_SAFE_INTEGER, used: 0, duration: durationSec, resetAt: now + durationSec };
  }

  try {
    return await getStateClient().ensureQuotaWindow(k, limitMicro, durationSec);
  } catch (error) {
    logger.warn('crypto_quota_window_fallback', { key: k, error: (error as Error)?.message ?? 'unknown' });
    const now = Math.floor(Date.now() / 1000);
    return { limit: Number.MAX_SAFE_INTEGER, used: 0, duration: durationSec, resetAt: now + durationSec };
  }
}

export function isCryptoQuotaFeatureActive(): boolean {
  return Boolean(QUOTA_ENABLED && isStateStoreAvailable());
}

export type CryptoPrecheck = {
  allowed: boolean;
  remainingGlobalEth: number;
  remainingUserEth: number;
  resetAt: number;
  network: string;
  reason?: 'global_exhausted' | 'user_exhausted';
};

/**
 * Pre-check both global (per-network) and per-address windows for the active network.
 * Limits are sourced from aiServerConfig.cryptoQuota (ETH amounts).
 */
export async function precheckCryptoSpend(address: string, amountEth: number): Promise<CryptoPrecheck> {
  const network = getActiveNetworkKey();
  const cfg = aiServerConfig.cryptoQuota;

  const duration = Math.max(1, cfg.durationSec);
  const globalLimitMicro = toMicro(Math.max(0, cfg.dailyLimitEth));
  const userLimitMicro = toMicro(Math.max(0, cfg.perUserLimitEth));

  // Treat 0 as "no cap" for that window
  const effectiveGlobalLimit = globalLimitMicro === 0 ? Number.MAX_SAFE_INTEGER : globalLimitMicro;
  const effectiveUserLimit = userLimitMicro === 0 ? Number.MAX_SAFE_INTEGER : userLimitMicro;

  const { globalKey, addrKey } = keysFor(network, address);
  const globalW = await ensureWindow(globalKey, effectiveGlobalLimit, duration);
  const userW = await ensureWindow(addrKey!, effectiveUserLimit, duration);

  const amountMicro = toMicro(amountEth);
  const remainingGlobal = Math.max(0, globalW.limit - globalW.used);
  const remainingUser = Math.max(0, userW.limit - userW.used);

  const allowedGlobal = remainingGlobal >= amountMicro;
  const allowedUser = remainingUser >= amountMicro;

  return {
    allowed: allowedGlobal && allowedUser,
    remainingGlobalEth: fromMicro(remainingGlobal),
    remainingUserEth: fromMicro(remainingUser),
    resetAt: Math.min(globalW.resetAt, userW.resetAt),
    network,
    reason: !allowedGlobal ? 'global_exhausted' : !allowedUser ? 'user_exhausted' : undefined,
  };
}

export async function recordCryptoSpend(address: string, amountEth: number): Promise<void> {
  if (!QUOTA_ENABLED || !isStateStoreAvailable()) return;
  const network = getActiveNetworkKey();
  const { globalKey, addrKey } = keysFor(network, address);

  const amountMicro = toMicro(amountEth);

  await getStateClient().incrementQuotaBatch([
    { key: globalKey, amount: amountMicro },
    { key: addrKey!, amount: amountMicro },
  ]);

  logger.info('crypto_quota_usage_added', {
    network,
    address: address.toLowerCase(),
    addEth: amountEth,
    addMicro: amountMicro,
  });
}

/** ---------- Reset Utilities (used by /api/quota-reset) ---------- **/

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function resetAllCryptoQuotas(
  opts?: { matchPrefix?: string; scanCount?: number },
): Promise<{ deleted: number; keys: string[] }> {
  if (!isStateStoreAvailable()) throw new Error('State service is not active');

  const prefixRaw = opts?.matchPrefix ?? PREFIX;
  const prefix = prefixRaw.endsWith('*') ? prefixRaw.slice(0, -1) : prefixRaw;
  const result = await getStateClient().resetQuotaPrefix(prefix);

  logger.warn('crypto_quota_reset_all', { scanned: result.keys.length, deleted: result.deleted });
  return result;
}

/** Reset per-address windows for the ACTIVE network only. */
export async function resetCryptoQuotasByAddresses(
  addresses: string[],
): Promise<{ deleted: number; keys: string[]; network: string }> {
  if (!isStateStoreAvailable()) throw new Error('State service is not active');

  const network = getActiveNetworkKey();
  const keys = addresses
    .map((a) => a?.toLowerCase?.().trim())
    .filter(Boolean)
    .map((addr) => `${PREFIX}:${network}:addr:${addr}`);

  let deleted = 0;
  for (const b of chunk(keys, 512)) {
    const res = await getStateClient().resetQuotaKeys(b);
    deleted += res.deleted;
  }

  logger.info('crypto_quota_reset_addresses', { network, count: addresses.length, deleted });
  return { deleted, keys, network };
}
