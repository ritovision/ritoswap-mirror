import 'server-only';
import { createLogger } from '@logger';
import { serverConfig } from '@config/server.env';
import { aiServerConfig } from '@config/ai.server';
import { getStateClient, isStateServiceEnabled } from '@/app/lib/state/client';
import type { QuotaWindow } from '@/app/lib/state/types';

const logger = createLogger('token-quota');

/**
 * Master flag & defaults now come from centralized AI server config.
 * - aiServerConfig.quota.enabled
 * - aiServerConfig.quota.tokens
 * - aiServerConfig.quota.windowSec
 */
const QUOTA_ENABLED = Boolean(aiServerConfig.quota.enabled);
const DEFAULT_LIMIT = Math.max(1, aiServerConfig.quota.tokens ?? 20_000);
const DEFAULT_DURATION = Math.max(1, aiServerConfig.quota.windowSec ?? 86_400);

function isStateStoreAvailable(): boolean {
  return serverConfig.stateService.isActive && isStateServiceEnabled();
}

// Public readiness (feature gate lives at caller level)
export function isQuotaFeatureActive(): boolean {
  // Quota is considered "active" only if the flag is ON and the state worker is available.
  return Boolean(QUOTA_ENABLED && isStateStoreAvailable());
}

// Key helpers
const QUOTA_PREFIX = 'chat:quota:';
function key(tokenId: string | number): string {
  return `${QUOTA_PREFIX}${tokenId}`;
}

type Window = QuotaWindow;

export async function ensureWindow(
  tokenId: string,
  opts?: { limit?: number; durationSec?: number },
): Promise<Window> {
  const limit = Math.max(1, opts?.limit ?? DEFAULT_LIMIT);
  const duration = Math.max(1, opts?.durationSec ?? DEFAULT_DURATION);

  // If quota is disabled, return an "unlimited" ephemeral window.
  if (!QUOTA_ENABLED) {
    const now = Math.floor(Date.now() / 1000);
    return {
      limit: Number.MAX_SAFE_INTEGER,
      used: 0,
      duration,
      resetAt: now + duration,
    };
  }

  if (!isStateStoreAvailable()) {
    const now = Math.floor(Date.now() / 1000);
    return {
      limit: Number.MAX_SAFE_INTEGER,
      used: 0,
      duration,
      resetAt: now + duration,
    };
  }

  try {
    return await getStateClient().ensureQuotaWindow(key(tokenId), limit, duration);
  } catch (error) {
    logger.warn('quota_window_fallback', {
      tokenId,
      error: (error as Error)?.message ?? 'unknown',
    });
    const now = Math.floor(Date.now() / 1000);
    return {
      limit: Number.MAX_SAFE_INTEGER,
      used: 0,
      duration,
      resetAt: now + duration,
    };
  }
}

export async function ensureAndCheck(
  tokenId: string,
  opts?: { limit?: number; durationSec?: number },
): Promise<{ allowed: boolean; remaining: number; window: Window }> {
  const window = await ensureWindow(tokenId, opts);
  const remaining = Math.max(0, window.limit - window.used);
  return { allowed: remaining > 0, remaining, window };
}

export async function addUsage(
  tokenId: string,
  amount: number,
): Promise<{ used: number; remaining: number } | null> {
  // Hard no-op when quota disabled.
  if (!QUOTA_ENABLED) return null;

  if (!isStateStoreAvailable()) return null;
  if (!Number.isFinite(amount) || amount <= 0) return null;

  try {
    const result = await getStateClient().incrementQuotaUsage(
      key(tokenId),
      Math.ceil(amount),
    );

    logger.info('quota_usage_added', { tokenId, add: amount, ...result });
    return result;
  } catch (error) {
    logger.warn('quota_usage_failed', {
      tokenId,
      error: (error as Error)?.message ?? 'unknown',
    });
    return null;
  }
}

/** ---------- Admin reset utilities ---------- **/

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Reset a single token's quota window (delete its key). Returns true if deleted. */
export async function resetTokenQuota(tokenId: string | number): Promise<boolean> {
  if (!isStateStoreAvailable()) throw new Error('State service is not active');
  const k = key(tokenId);
  const result = await getStateClient().resetQuotaKeys([k]);
  const deleted = result.deleted > 0;
  if (deleted) logger.info('quota_reset_token', { tokenId, key: k });
  return deleted;
}

/** Reset multiple tokens by ID. Returns number of keys deleted and the list of attempted keys. */
export async function resetManyTokenQuotas(
  tokenIds: Array<string | number>,
): Promise<{ deleted: number; keys: string[] }> {
  if (!isStateStoreAvailable()) throw new Error('State service is not active');
  const keys = tokenIds.map((id) => key(id));

  let deleted = 0;
  for (const batch of chunk(keys, 512)) {
    const res = await getStateClient().resetQuotaKeys(batch);
    deleted += res.deleted;
  }
  logger.info('quota_reset_many', { count: tokenIds.length, deleted });
  return { deleted, keys };
}

/** Scan+delete all quota keys. Use MATCH to avoid KEYS. */
export async function resetAllQuotas(
  opts?: { matchPrefix?: string; scanCount?: number },
): Promise<{ deleted: number; keys: string[] }> {
  if (!isStateStoreAvailable()) throw new Error('State service is not active');

  const prefixRaw = opts?.matchPrefix ?? QUOTA_PREFIX;
  const prefix = prefixRaw.endsWith('*') ? prefixRaw.slice(0, -1) : prefixRaw;
  const result = await getStateClient().resetQuotaPrefix(prefix);

  logger.warn('quota_reset_all', { scanned: result.keys.length, deleted: result.deleted });
  return result;
}

/** ---------- Heuristic token counting ---------- **/

/** Simple heuristic: ~4 chars per token (English-ish). */
export function estimateTokensFromText(text: string): number {
  return Math.ceil(Math.max(1, text.length / 4));
}

/** Internal helper to flatten AI-SDK style message parts into plain text. */
function _extractTextFromParts(parts: unknown[] | undefined): string {
  if (!parts || !Array.isArray(parts)) return '';
  return parts
    .map((p: unknown) => {
      if (p && typeof p === 'object') {
        const obj = p as { text?: unknown; type?: unknown; value?: unknown };
        if (typeof obj.text === 'string') return obj.text;
        if (obj.type === 'text' && typeof obj.value === 'string') return obj.value;
      }
      return JSON.stringify(p);
    })
    .join(' ');
}

/**
 * Estimate input tokens from model messages + optional system prompt
 * using the chars/4 heuristic.
 */
export function estimateInputTokensFromModelMessages(
  modelMessages: unknown[],
  systemPrompt?: string,
): number {
  const inputText =
    modelMessages
      .map((m: unknown) => {
        if (m && typeof m === 'object') {
          const obj = m as { content?: unknown };
          if (typeof obj.content === 'string') return obj.content;
          return _extractTextFromParts(obj.content as unknown[] | undefined);
        }
        return '';
      })
      .join(' ') + (systemPrompt ?? '');
  return estimateTokensFromText(inputText);
}

type TokenCounter = {
  stream: TransformStream<Uint8Array, Uint8Array>;
  /** Current total tokens (input + output-so-far). */
  getTotal: () => number;
  /**
   * Idempotent: finalizes and invokes onClose once, returning the total used.
   * Safe to call from finally/abort handlers.
   */
  close: () => Promise<number> | number;
};

/**
 * Create a TransformStream that counts output tokens via the chars/4 heuristic.
 * - initialInputTokens: pre-counted prompt tokens
 * - onClose(total): optional callback fired once at completion/close
 */
export function createHeuristicTokenCounter(opts?: {
  initialInputTokens?: number;
  onClose?: (totalTokensUsed: number) => void | Promise<void>;
}): TokenCounter {
  const initial = Math.max(0, opts?.initialInputTokens ?? 0);
  const decoder = new TextDecoder();
  let accumulated = '';
  let closed = false;

  const getTotal = () => initial + estimateTokensFromText(accumulated);

  const maybeClose = async () => {
    if (closed) return getTotal();
    closed = true;
    const total = getTotal();
    try {
      await opts?.onClose?.(total);
    } catch {
      // swallow to avoid breaking response pipeline
    }
    return total;
  };

  const stream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      const text = decoder.decode(chunk);
      accumulated += text;
      controller.enqueue(chunk);
    },
    async flush() {
      await maybeClose();
    },
  });

  return {
    stream,
    getTotal,
    close: maybeClose,
  };
}
