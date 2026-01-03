import {
  type Env,
  type JsonResult,
  type QuotaWindow,
  type RateLimitResult,
  type StateAction,
} from '../types';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function ok<T>(result: T): Response {
  const body: JsonResult<T> = { ok: true, result };
  return new Response(JSON.stringify(body), { status: 200, headers: JSON_HEADERS });
}

function fail(message: string, status = 400): Response {
  const body: JsonResult<never> = { ok: false, error: message };
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

type RateEntry = {
  timestamps: number[];
};

export class StateDurableObject {
  private storage: DurableObjectStorage;

  constructor(private state: DurableObjectState, private env: Env) {
    this.storage = state.storage;
  }

  async fetch(request: Request): Promise<Response> {
    let action: StateAction;
    try {
      action = (await request.json()) as StateAction;
    } catch (error) {
      console.error('State DO received invalid JSON', error);
      return fail('Invalid JSON payload');
    }

    switch (action.action) {
      case 'nonce:set':
        return this.handleNonceSet(action);
      case 'nonce:get':
        return this.handleNonceGet(action);
      case 'nonce:consume':
        return this.handleNonceConsume(action);
      case 'ratelimit:check':
        return this.handleRateLimitCheck(action);
      case 'quota:ensure':
        return this.handleQuotaEnsure(action);
      case 'quota:increment':
        return this.handleQuotaIncrement(action);
      case 'quota:incrementBatch':
        return this.handleQuotaIncrementBatch(action);
      case 'quota:resetKeys':
        return this.handleQuotaResetKeys(action);
      case 'quota:resetPrefix':
        return this.handleQuotaResetPrefix(action);
      default:
        return fail('Unsupported action');
    }
  }

  private async handleNonceSet(payload: Extract<StateAction, { action: 'nonce:set' }>) {
    const ttlSeconds = Math.max(1, Math.floor(payload.ttlSeconds));
    const expiration = Math.floor(Date.now() / 1000) + ttlSeconds;
    await this.storage.put(this.nonceKey(payload.identifier), payload.value, {
      expiration,
    });
    return ok(true);
  }

  private async handleNonceGet(payload: Extract<StateAction, { action: 'nonce:get' }>) {
    const value = await this.storage.get<string>(this.nonceKey(payload.identifier));
    return ok(value ?? null);
  }

  private async handleNonceConsume(payload: Extract<StateAction, { action: 'nonce:consume' }>) {
    const key = this.nonceKey(payload.identifier);
    const value = await this.storage.get<string>(key);
    if (value !== undefined) {
      await this.storage.delete(key);
    }
    return ok(value ?? null);
  }

  private nonceKey(identifier: string) {
    return `nonce:${identifier}`;
  }

  private async handleRateLimitCheck(
    payload: Extract<StateAction, { action: 'ratelimit:check' }>,
  ) {
    const limit = Math.max(1, Math.floor(payload.limit));
    const windowMs = Math.max(1, Math.floor(payload.windowSeconds * 1000));
    const key = `rate:${payload.limiter}:${payload.identifier}`;

    const now = Date.now();
    const record = (await this.storage.get<RateEntry>(key)) ?? { timestamps: [] };
    const timestamps = record.timestamps.filter((ts) => now - ts < windowMs);
    let success = false;

    if (timestamps.length < limit) {
      timestamps.push(now);
      success = true;
    }

    const firstTs = timestamps[0] ?? now;
    const reset = firstTs + windowMs;
    const expiration = Math.ceil(reset / 1000);
    await this.storage.put(key, { timestamps }, { expiration });

    const remaining = success ? Math.max(0, limit - timestamps.length) : 0;
    const result: RateLimitResult = { success, limit, remaining, reset };

    return ok(result);
  }

  private async ensureQuotaWindow(key: string, limit: number, durationSec: number): Promise<QuotaWindow> {
    const normalizedLimit = Math.max(1, Math.floor(limit));
    const duration = Math.max(1, Math.floor(durationSec));
    const now = Math.floor(Date.now() / 1000);

    let window = await this.storage.get<QuotaWindow>(key);
    if (!window || window.resetAt <= now) {
      window = {
        limit: normalizedLimit,
        used: 0,
        duration,
        resetAt: now + duration,
      };
      await this.storage.put(key, window, { expiration: window.resetAt });
      return window;
    }

    return window;
  }

  private async handleQuotaEnsure(payload: Extract<StateAction, { action: 'quota:ensure' }>) {
    const window = await this.ensureQuotaWindow(payload.key, payload.limit, payload.durationSec);
    return ok(window);
  }

  private async handleQuotaIncrement(payload: Extract<StateAction, { action: 'quota:increment' }>) {
    const window = await this.storage.get<QuotaWindow>(payload.key);
    if (!window) {
      return fail('Quota window not initialized', 404);
    }

    const amount = Math.max(0, Math.ceil(payload.amount));
    const used = window.used + amount;
    const next = { ...window, used };
    await this.storage.put(payload.key, next, { expiration: next.resetAt });
    return ok({ used: next.used, remaining: Math.max(0, next.limit - next.used) });
  }

  private async handleQuotaIncrementBatch(
    payload: Extract<StateAction, { action: 'quota:incrementBatch' }>,
  ) {
    for (const entry of payload.entries) {
      const amount = Math.max(0, Math.ceil(entry.amount));
      const window = await this.storage.get<QuotaWindow>(entry.key);
      if (!window) {
        return fail(`Quota window "${entry.key}" not initialized`, 404);
      }
      const updated = { ...window, used: window.used + amount };
      await this.storage.put(entry.key, updated, { expiration: updated.resetAt });
    }
    return ok(true);
  }

  private async handleQuotaResetKeys(
    payload: Extract<StateAction, { action: 'quota:resetKeys' }>,
  ) {
    for (const key of payload.keys) {
      await this.storage.delete(key);
    }
    return ok({ deleted: payload.keys.length, keys: payload.keys });
  }

  private async handleQuotaResetPrefix(
    payload: Extract<StateAction, { action: 'quota:resetPrefix' }>,
  ) {
    const listed = await this.storage.list<QuotaWindow>({
      prefix: payload.prefix,
    });
    const keys = Array.from(listed.keys());

    for (const key of keys) {
      await this.storage.delete(key);
    }
    return ok({ deleted: keys.length, keys });
  }
}
