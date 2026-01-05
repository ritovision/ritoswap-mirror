import type { RateLimitCheckResult } from '@/app/schemas/domain/rate-limit.domain';

export type QuotaWindow = {
  limit: number;
  used: number;
  duration: number;
  resetAt: number;
};

export type RateLimitCheckPayload = {
  limiter: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
};

export interface DurableStateClient {
  storeNonce(identifier: string, value: string, ttlSeconds: number): Promise<void>;
  getNonce(identifier: string): Promise<string | null>;
  consumeNonce(identifier: string): Promise<string | null>;
  checkRateLimit(params: RateLimitCheckPayload): Promise<RateLimitCheckResult>;
  ensureQuotaWindow(key: string, limit: number, durationSec: number): Promise<QuotaWindow>;
  incrementQuotaUsage(
    key: string,
    amount: number,
  ): Promise<{ used: number; remaining: number }>;
  incrementQuotaBatch(entries: Array<{ key: string; amount: number }>): Promise<void>;
  resetQuotaKeys(keys: string[]): Promise<{ deleted: number; keys: string[] }>;
  resetQuotaPrefix(prefix: string): Promise<{ deleted: number; keys: string[] }>;
}
