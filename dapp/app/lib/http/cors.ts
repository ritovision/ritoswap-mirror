// lib/http/cors.ts
import { NextRequest, NextResponse } from 'next/server'

export type CorsOptions = {
  /** Allowed origins. Use '*' only if allowCredentials=false. */
  allowOrigins?: string[] | '*'
  /** Methods to advertise/allow. */
  allowMethods?: string[]
  /** Allowed headers; defaults to the browser's Access-Control-Request-Headers. */
  allowHeaders?: string[]
  /** Whether to send Access-Control-Allow-Credentials. */
  allowCredentials?: boolean
  /** Seconds for Access-Control-Max-Age (preflight cache). */
  maxAge?: number
}

/** Sensible defaults for docs site + local dev. */
const DEFAULT_ALLOWED_ORIGINS: string[] = [
  'https://docs.ritoswap.com',
  'http://localhost:3001',
  'http://localhost:3000',
].filter(Boolean)

const DEFAULTS: Required<Omit<CorsOptions, 'allowOrigins'>> & { allowOrigins: string[] | '*' } = {
  allowOrigins: DEFAULT_ALLOWED_ORIGINS,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: [], // if empty we'll reflect Access-Control-Request-Headers or fallback
  allowCredentials: false,
  maxAge: 600,
}

/** Build CORS headers for a given request + options. */
export function corsHeaders(req: Request, opts: CorsOptions = {}): Headers {
  const cfg = { ...DEFAULTS, ...opts }
  const origin = req.headers.get('origin') ?? ''
  const reqHeaders = req.headers.get('access-control-request-headers') ?? ''

  const h = new Headers()
  // Help caches do the right thing
  h.set('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers')

  // Resolve allowed origin
  let allowedOrigin = ''
  if (cfg.allowOrigins === '*') {
    allowedOrigin = cfg.allowCredentials ? origin : '*'
  } else if (origin && cfg.allowOrigins.includes(origin)) {
    allowedOrigin = origin
  }

  if (allowedOrigin) h.set('Access-Control-Allow-Origin', allowedOrigin)
  if (cfg.allowCredentials) h.set('Access-Control-Allow-Credentials', 'true')

  h.set('Access-Control-Allow-Methods', cfg.allowMethods.join(', '))
  const allowHeaders =
    (cfg.allowHeaders && cfg.allowHeaders.length > 0
      ? cfg.allowHeaders.join(', ')
      : reqHeaders || 'Content-Type, Authorization')
  h.set('Access-Control-Allow-Headers', allowHeaders)

  if (cfg.maxAge >= 0) h.set('Access-Control-Max-Age', String(cfg.maxAge))

  return h
}

/** Early-exit handler for OPTIONS preflight. Returns a 204 if handled, else null. */
export function handleCors(req: NextRequest, opts?: CorsOptions): NextResponse | null {
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders(req, opts) })
  }
  return null
}

/** Merge CORS headers into a response. */
export function withCors(res: NextResponse, req: NextRequest, opts?: CorsOptions): NextResponse {
  const cors = corsHeaders(req, opts)
  cors.forEach((v, k) => res.headers.set(k, v))
  return res
}

/** Convenience wrapper for JSON responses with CORS applied. */
export function corsJson<T>(
  req: NextRequest,
  body: T,
  init: ResponseInit = {},
  opts?: CorsOptions
): NextResponse {
  return withCors(NextResponse.json(body, init), req, opts)
}
