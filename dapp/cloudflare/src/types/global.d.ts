declare interface DurableObjectId {}

declare interface DurableObjectStub {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

declare interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

declare interface DurableObjectPutOptions {
  expiration?: number;
}

declare interface DurableObjectListOptions {
  prefix?: string;
}

interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T, options?: DurableObjectPutOptions): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T = unknown>(options?: DurableObjectListOptions): Promise<Map<string, { value: T }>>;
  transaction<T>(closure: (txn: DurableObjectStorageTransaction) => T | Promise<T>): Promise<T>;
  deleteAll(): Promise<void>;
}

interface DurableObjectStorageTransaction extends DurableObjectStorage {}

declare interface DurableObjectState {
  readonly storage: DurableObjectStorage;
  waitUntil(promise: Promise<unknown>): void;
  blockConcurrencyWhile<T>(closure: () => Promise<T>): Promise<T>;
}

declare interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
