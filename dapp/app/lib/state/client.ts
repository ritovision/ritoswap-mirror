import 'server-only';

import { serverConfig } from '@config/server.env';
import { createLogger } from '@logger';
import type {
  DurableStateClient,
  QuotaWindow,
  RateLimitCheckPayload,
} from './types';
import type { RateLimitCheckResult } from '@/app/schemas/domain/rate-limit.domain';

const logger = createLogger('DurableStateClient');

type StateResponse<T> = { ok: true; result: T } | { ok: false; error: string };

type ClientConfig = {
  url: string;
  apiKey: string;
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

class CloudflareStateClient implements DurableStateClient {
  constructor(private readonly config: ClientConfig) {}

  private async request<T>(body: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.config.url, {
      method: 'POST',
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    let json: StateResponse<T>;
    try {
      json = (await response.json()) as StateResponse<T>;
    } catch (error) {
      logger.error('State service returned invalid JSON', { error });
      throw new Error('State service returned invalid JSON');
    }

    if (!response.ok) {
      logger.error('State service HTTP error', { status: response.status });
      throw new Error(`State service HTTP ${response.status}`);
    }

    if (!json.ok) {
      logger.warn('State service application error', {
        action: body.action,
        error: json.error,
      });
      throw new Error(json.error || 'State service error');
    }

    return json.result;
  }

  async storeNonce(identifier: string, value: string, ttlSeconds: number): Promise<void> {
    await this.request({
      action: 'nonce:set',
      identifier,
      value,
      ttlSeconds,
    });
  }

  async getNonce(identifier: string): Promise<string | null> {
    return this.request<string | null>({
      action: 'nonce:get',
      identifier,
    });
  }

  async consumeNonce(identifier: string): Promise<string | null> {
    return this.request<string | null>({
      action: 'nonce:consume',
      identifier,
    });
  }

  async checkRateLimit(params: RateLimitCheckPayload): Promise<RateLimitCheckResult> {
    return this.request<RateLimitCheckResult>({
      action: 'ratelimit:check',
      ...params,
    });
  }

  async ensureQuotaWindow(
    key: string,
    limit: number,
    durationSec: number,
  ): Promise<QuotaWindow> {
    return this.request<QuotaWindow>({
      action: 'quota:ensure',
      key,
      limit,
      durationSec,
    });
  }

  async incrementQuotaUsage(
    key: string,
    amount: number,
  ): Promise<{ used: number; remaining: number }> {
    return this.request<{ used: number; remaining: number }>({
      action: 'quota:increment',
      key,
      amount,
    });
  }

  async incrementQuotaBatch(entries: Array<{ key: string; amount: number }>): Promise<void> {
    if (!entries.length) return;
    await this.request({
      action: 'quota:incrementBatch',
      entries,
    });
  }

  async resetQuotaKeys(keys: string[]): Promise<{ deleted: number; keys: string[] }> {
    if (!keys.length) return { deleted: 0, keys: [] };
    return this.request<{ deleted: number; keys: string[] }>({
      action: 'quota:resetKeys',
      keys,
    });
  }

  async resetQuotaPrefix(prefix: string): Promise<{ deleted: number; keys: string[] }> {
    return this.request<{ deleted: number; keys: string[] }>({
      action: 'quota:resetPrefix',
      prefix,
    });
  }
}

let singletonClient: DurableStateClient | null = null;

export const isStateServiceEnabled = (): boolean => {
  return serverConfig.stateService.isActive;
};

export const getStateClient = (): DurableStateClient => {
  if (!isStateServiceEnabled()) {
    throw new Error('Durable state service is disabled');
  }
  if (!singletonClient) {
    const { url, apiKey } = serverConfig.stateService;
    if (!url || !apiKey) {
      throw new Error('Durable state service configuration missing');
    }
    singletonClient = new CloudflareStateClient({ url, apiKey });
  }
  return singletonClient;
};

export const __setStateClientMock = (client: DurableStateClient | null) => {
  singletonClient = client;
};
