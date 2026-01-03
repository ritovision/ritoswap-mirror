import { describe, it, expect } from 'vitest';
import { StateDurableObject } from '../durable/state';
import type { Env } from '../types';

class FakeStorage implements DurableObjectStorage {
  private data = new Map<string, { value: any; expiration?: number }>();

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.data.get(key);
    if (!entry) return undefined;
    if (entry.expiration && entry.expiration <= Math.floor(Date.now() / 1000)) {
      this.data.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  async put(key: string, value: any, options?: DurableObjectPutOptions): Promise<void> {
    const expiration = options?.expiration;
    this.data.set(key, { value, expiration });
  }

  async delete(key: string): Promise<boolean> {
    return this.data.delete(key);
  }

  async list<T>(options?: DurableObjectListOptions): Promise<Map<string, T>> {
    const prefix = options?.prefix ?? '';
    const result = new Map<string, T>();
    for (const [key, value] of this.data.entries()) {
      if (key.startsWith(prefix)) {
        result.set(key, value.value as T);
      }
    }
    return result;
  }

  // Unused interfaces
  async transaction<T>(closure: (txn: DurableObjectStorageTransaction) => T | Promise<T>): Promise<T> {
    const txn = this as unknown as DurableObjectStorageTransaction;
    return closure(txn);
  }
  async sync(): Promise<void> {}
  async deleteAll(): Promise<void> {
    this.data.clear();
  }
}

class FakeState implements DurableObjectState {
  storage: DurableObjectStorage = new FakeStorage();
  waitUntil() {}
  blockConcurrencyWhile<T>(closure: () => Promise<T>): Promise<T> {
    return closure();
  }
  id = {} as DurableObjectId;
}

const env = {} as Env;

const createRequest = (body: object) =>
  new Request('https://worker.internal/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('StateDurableObject', () => {
  it('stores and retrieves nonces', async () => {
    const state = new FakeState();
    const durable = new StateDurableObject(state as DurableObjectState, env);

    const setRes = await durable.fetch(
      createRequest({ action: 'nonce:set', identifier: 'abc', value: '123', ttlSeconds: 10 }),
    );
    expect(setRes.status).toBe(200);

    const getRes = await durable.fetch(
      createRequest({ action: 'nonce:get', identifier: 'abc' }),
    );
    const data = await getRes.json();
    expect(data.result).toBe('123');

    const consumeRes = await durable.fetch(
      createRequest({ action: 'nonce:consume', identifier: 'abc' }),
    );
    expect((await consumeRes.json()).result).toBe('123');
  });

  it('enforces rate limits per identifier', async () => {
    const state = new FakeState();
    const durable = new StateDurableObject(state as DurableObjectState, env);

    for (let i = 0; i < 3; i++) {
      const check = await durable.fetch(
        createRequest({
          action: 'ratelimit:check',
          limiter: 'test',
          identifier: 'ip',
          limit: 2,
          windowSeconds: 60,
        }),
      );
      const { result } = await check.json();
      if (i < 2) {
        expect(result.success).toBe(true);
      } else {
        expect(result.success).toBe(false);
      }
    }
  });
});
