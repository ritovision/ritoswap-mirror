import { NextRequest } from 'next/server';
import { createLogger } from '@logger';
import { aiServerConfig } from '@config/ai.server';
import { resetAllQuotas as resetAllTokenQuotas, resetManyTokenQuotas } from '@lib/quotas/token-quota';
import { serverConfig } from '@config/server.env';
import { resetAllCryptoQuotas, resetCryptoQuotasByAddresses } from '@lib/quotas/crypto-quota';

const logger = createLogger('quota-reset-api');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Constant-time(ish) equality:
 * - Compare UTF-8 bytes without early return.
 * - Iterate to max length and XOR bytes (missing bytes treated as 0).
 * - Avoids Node Buffer/ArrayBuffer typing issues and works in Next.
 */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = 0;
  for (let i = 0; i < len; i++) {
    const x = ab[i] ?? 0;
    const y = bb[i] ?? 0;
    diff |= x ^ y;
  }
  return diff === 0 && ab.length === bb.length;
}

type SecretProbeSource =
  | 'header:x-quota-reset-secret'
  | 'header:x-ai-quota-reset-secret'
  | 'authorization-bearer'
  | 'body'
  | 'query'
  | 'none';

function normalizePossibleBearer(val: string | null): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (/^Bearer\s+/i.test(trimmed)) return trimmed.replace(/^Bearer\s+/i, '').trim();
  return trimmed;
}

function probeSecret(req: NextRequest, body: unknown): { value: string; source: SecretProbeSource } {
  // 1) main custom header
  const h1 = normalizePossibleBearer(req.headers.get('x-quota-reset-secret'));
  if (h1) return { value: h1, source: 'header:x-quota-reset-secret' };

  // 2) alt header name
  const h2 = normalizePossibleBearer(req.headers.get('x-ai-quota-reset-secret'));
  if (h2) return { value: h2, source: 'header:x-ai-quota-reset-secret' };

  // 3) Authorization: Bearer <secret>
  const auth = req.headers.get('authorization');
  const authToken = normalizePossibleBearer(auth);
  if (auth && /^Bearer\s+/i.test(auth)) {
    return { value: authToken, source: 'authorization-bearer' };
  }

  // 4) JSON body { "secret": "..." }
  let bodySecret = '';
  if (body && typeof body === 'object' && 'secret' in body) {
    const v = (body as { secret?: unknown }).secret;
    bodySecret = typeof v === 'string' ? v.trim() : '';
  }
  if (bodySecret) return { value: bodySecret, source: 'body' };

  // 5) Query ?secret=...
  const url = new URL(req.url);
  const qp = (url.searchParams.get('secret') || '').trim();
  if (qp) return { value: qp, source: 'query' };

  return { value: '', source: 'none' };
}

type Scope = 'token' | 'crypto' | 'both';

export async function POST(req: NextRequest) {
  const body: unknown = await req.json().catch(() => ({}));

  // Feature switch: disabled unless a non-empty secret is configured
  if (!aiServerConfig.quotaReset.enabled) {
    logger.warn('quota_reset_disabled', { enabled: false });
    return new Response(JSON.stringify({ error: 'Quota reset disabled' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Infra readiness
  if (!serverConfig.stateService.isActive) {
    logger.warn('quota_reset_state_service_inactive');
    return new Response(JSON.stringify({ error: 'State service inactive' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { value: provided, source } = probeSecret(req, body);
  const configured = (aiServerConfig.secrets.quotaResetSecret ?? '').trim();

  const diag = {
    resetEnabled: aiServerConfig.quotaReset.enabled,
    stateServiceActive: serverConfig.stateService.isActive,
    providedSource: source,
    providedPresent: provided.length > 0,
    providedLength: provided.length,
    configuredPresent: configured.length > 0,
    configuredLength: configured.length,
  };

  if (!provided || !configured || !safeEqual(provided, configured)) {
    logger.warn('quota_reset_auth_failed', diag);
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'X-Why': !provided ? 'missing-secret' : !configured ? 'no-configured-secret' : 'mismatch',
      },
    });
  }

  const b = (body && typeof body === 'object' ? (body as Record<string, unknown>) : {}) as {
    scope?: unknown;
    tokenIds?: unknown;
    addresses?: unknown;
    all?: unknown;
  };

  const scope: Scope =
    b.scope === 'token'
      ? 'token'
      : b.scope === 'crypto'
      ? 'crypto'
      : b.scope === 'both'
      ? 'both'
      : Array.isArray(b.tokenIds) || b.all === true
      ? 'token'
      : Array.isArray(b.addresses)
      ? 'crypto'
      : 'token';

  const all = b.all === true;
  const tokenIdsRaw = b.tokenIds as unknown;
  const addressesRaw = b.addresses as unknown;

  try {
    if (all) {
      if (scope === 'token') {
        const t = await resetAllTokenQuotas();
        logger.warn('quota_reset_all_token_ok', { deleted: t.deleted, scanned: t.keys.length });
        return new Response(JSON.stringify({ ok: true, scope, mode: 'all', token: t }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (scope === 'crypto') {
        const c = await resetAllCryptoQuotas();
        logger.warn('quota_reset_all_crypto_ok', { deleted: c.deleted, scanned: c.keys.length });
        return new Response(JSON.stringify({ ok: true, scope, mode: 'all', crypto: c }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        const [t, c] = await Promise.all([resetAllTokenQuotas(), resetAllCryptoQuotas()]);
        logger.warn('quota_reset_all_both_ok', { tokenDeleted: t.deleted, cryptoDeleted: c.deleted });
        return new Response(JSON.stringify({ ok: true, scope, mode: 'all', token: t, crypto: c }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (scope === 'token') {
      const tokenIds: Array<string | number> = Array.isArray(tokenIdsRaw)
        ? (tokenIdsRaw as unknown[]).map((v) =>
            typeof v === 'number' ? v : typeof v === 'string' ? v.trim() : String(v),
          )
        : [];

      if (tokenIds.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Provide { all: true } or a non-empty tokenIds[] array' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      const result = await resetManyTokenQuotas(tokenIds);
      logger.info('quota_reset_token_ids_ok', { count: tokenIds.length, deleted: result.deleted });
      return new Response(JSON.stringify({ ok: true, scope, mode: 'ids', token: result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (scope === 'crypto') {
      const addresses: string[] = Array.isArray(addressesRaw)
        ? (addressesRaw as unknown[]).map((a) => String(a).trim()).filter(Boolean)
        : [];

      if (addresses.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Provide { all: true } or a non-empty addresses[] array' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      const result = await resetCryptoQuotasByAddresses(addresses);
      logger.info('quota_reset_crypto_addresses_ok', { count: addresses.length, deleted: result.deleted, network: result.network });
      return new Response(JSON.stringify({ ok: true, scope, mode: 'addresses', crypto: result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unsupported request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('quota_reset_failed', { error: message });
    return new Response(JSON.stringify({ error: 'Reset failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
