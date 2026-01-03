// app/lib/client/api/_http.ts
import { z } from 'zod';
import { RateLimitInfoSchema, type RateLimitInfo } from '@/app/schemas/dto/common.dto';

/** Fallback error when the response didn't match the expected schema. */
export type UnknownApiError = { error: string; raw?: unknown };

/**
 * Minimal result wrapper used by all client calls.
 * Never throws on shape errors; instead returns a typed error branch.
 */
export type ApiResult<TSuccess, TError = unknown> =
  | { ok: true; status: number; data: TSuccess; rateLimit?: RateLimitInfo; headers: Headers }
  | { ok: false; status: number; error: TError; rateLimit?: RateLimitInfo; headers: Headers };

/** Extract rate-limit info from headers if present. */
function rateLimitFromHeaders(headers: Headers): RateLimitInfo | undefined {
  const limit = headers.get('X-RateLimit-Limit');
  const remaining = headers.get('X-RateLimit-Remaining');
  const retryAfter = headers.get('Retry-After');
  if (!limit || !remaining || !retryAfter) return undefined;

  const candidate = {
    limit: Number(limit),
    remaining: Number(remaining),
    retryAfter: Number(retryAfter),
  };

  const parsed = RateLimitInfoSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Perform a JSON fetch and validate against success/error schemas.
 * - S: Zod schema for success payload
 * - E: Zod schema for error payload
 *
 * Returns ApiResult<infer S, infer E | UnknownApiError>.
 */
export async function requestJSON<S extends z.ZodTypeAny, E extends z.ZodTypeAny>(
  input: RequestInfo | URL,
  init: RequestInit,
  successSchema: S,
  errorSchema: E
): Promise<ApiResult<z.infer<S>, z.infer<E> | UnknownApiError>> {
  const res = await fetch(input, init);
  const headers = res.headers;
  const rateLimit = rateLimitFromHeaders(headers);

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = undefined;
  }

  if (res.ok) {
    const parsed = successSchema.safeParse(json);
    if (parsed.success) {
      return { ok: true, status: res.status, data: parsed.data, rateLimit, headers };
    }
    // 200-range but shape didn't match the success schema
    return {
      ok: false,
      status: res.status,
      error: { error: 'Invalid success response shape', raw: json },
      rateLimit,
      headers,
    };
  }

  const parsedErr = errorSchema.safeParse(json);
  const errorPayload = parsedErr.success
    ? parsedErr.data
    : ({ error: 'Invalid error response shape', raw: json } as UnknownApiError);

  return {
    ok: false,
    status: res.status,
    error: errorPayload,
    rateLimit,
    headers,
  };
}

/** JSON headers helper */
export const jsonHeaders: HeadersInit = {
  'Content-Type': 'application/json',
};
