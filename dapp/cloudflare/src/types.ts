export interface Env {
  BREVO_API_KEY?: string;
  SENDER_EMAIL?: string;
  RECEIVER_EMAIL?: string;
  STATE_SERVICE_AUTH_TOKEN?: string;
  STATE_STORE: DurableObjectNamespace;
}

export type JsonResult<T> =
  | { ok: true; result: T }
  | { ok: false; error: string };

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

export type QuotaWindow = {
  limit: number;
  used: number;
  duration: number;
  resetAt: number;
};

export type StateAction =
  | { action: 'nonce:set'; identifier: string; value: string; ttlSeconds: number }
  | { action: 'nonce:get'; identifier: string }
  | { action: 'nonce:consume'; identifier: string }
  | {
      action: 'ratelimit:check';
      limiter: string;
      identifier: string;
      limit: number;
      windowSeconds: number;
    }
  | {
      action: 'quota:ensure';
      key: string;
      limit: number;
      durationSec: number;
    }
  | { action: 'quota:increment'; key: string; amount: number }
  | {
      action: 'quota:incrementBatch';
      entries: Array<{ key: string; amount: number }>;
    }
  | { action: 'quota:resetKeys'; keys: string[] }
  | { action: 'quota:resetPrefix'; prefix: string };
