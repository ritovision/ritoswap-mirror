// dapp/app/lib/mcp/server/auth.ts
import { createLogger } from '@logger';
import { verifyAccessToken, readBearerFromRequest } from '@lib/jwt/server';
import { aiPublicConfig } from '@config/ai.public';
import { cookies } from 'next/headers';

const logger = createLogger('mcp-auth');

export interface AuthClaims {
  sub?: string;
  address?: string;
  addr?: string;
  [k: string]: unknown;
}

export interface AuthResult {
  authenticated: boolean;
  tokenId?: string;
  error?: string;
  /** Raw (verified) JWT claims so dispatch can inject address into tool args. */
  claims?: AuthClaims;
}

type VerifyOpts = {
  /** When true, enforce JWT verification even if global config is off. */
  force?: boolean;
};

function extractJwtFromBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const root = body as Record<string, unknown>;
  const direct = root['jwt'];
  if (typeof direct === 'string' && direct) return direct;

  const data = root['data'];
  if (data && typeof data === 'object') {
    const nested = (data as Record<string, unknown>)['jwt'];
    if (typeof nested === 'string' && nested) return nested;
  }
  return null;
}

function coerceClaims(input: unknown): AuthClaims {
  const base: Record<string, unknown> = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {};
  return {
    ...(base as AuthClaims),
    sub: typeof base.sub === 'string' ? base.sub : undefined,
    address: typeof base.address === 'string' ? base.address : undefined,
    addr: typeof base.addr === 'string' ? base.addr : undefined,
  };
}

/**
 * Verify JWT authentication for MCP requests.
 * If opts.force is true, verification is performed regardless of global toggle.
 * Returns verified claims so callers can inject identity into tool args.
 */
export async function verifyMCPAuth(req: Request, body?: unknown, opts?: VerifyOpts): Promise<AuthResult> {
  const force = Boolean(opts?.force);

  // Respect global switch unless forced by a per-tool requirement.
  if (!force && !aiPublicConfig.requiresJwt) {
    return { authenticated: true };
  }

  const rid = `mcp-auth-${Date.now()}`;

  try {
    // Extract JWT from Authorization header first
    let jwt: string | null = readBearerFromRequest(req);

    // Fallbacks: body.jwt or body.data.jwt
    if (!jwt) {
      const fromBody = extractJwtFromBody(body);
      if (fromBody) {
        jwt = fromBody;
        logger.debug('JWT found in body', { rid });
      }
    }

    // Fallback: cookies (if available)
    if (!jwt) {
      try {
        const c = cookies();
        jwt = c.get('access_token')?.value || c.get('jwt')?.value || null;
        if (jwt) logger.debug('JWT found in cookies', { rid });
      } catch {
        // Cookies may not be available in all contexts
      }
    }

    if (!jwt) {
      return { authenticated: false, error: 'Authentication required: missing JWT' };
    }

    // Verify and expose claims
    const verifiedUnknown = await verifyAccessToken(jwt);
    const verified = verifiedUnknown as Partial<{ payload: Record<string, unknown>; tokenId: string }>;

    const payloadRecord: Record<string, unknown> = (verified?.payload ?? {}) as Record<string, unknown>;
    const payload = coerceClaims(payloadRecord);

    const tokenId: string | undefined =
      typeof payloadRecord.tokenId === 'string'
        ? (payloadRecord.tokenId as string)
        : typeof verified?.tokenId === 'string'
        ? verified.tokenId
        : undefined;

    logger.info('MCP authentication successful', { rid, tokenId, sub: payload?.sub });
    return { authenticated: true, tokenId, claims: payload };
  } catch (error) {
    logger.error('MCP authentication failed', {
      rid,
      error: error instanceof Error ? error.message : String(error),
    });
    return { authenticated: false, error: 'Authentication failed: invalid JWT' };
  }
}
