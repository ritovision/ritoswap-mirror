/* app/api/form-submission-gate/route.ts */
import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, defineChain } from 'viem'
import { mainnet, sepolia } from 'viem/chains'
import { fullKeyTokenAbi, KEY_TOKEN_ADDRESS } from '@config/contracts'
import { getTokenModel, getChainConfig } from '@lib/prisma/prismaNetworkUtils'
import { checkRateLimitWithNonce } from '@lib/rateLimit/rateLimit.server'
import { createLogger } from '@logger'
import { randomUUID } from 'crypto'
import { assertLegacyAuth, getRequestHost } from '@lib/auth/nonSiweAuth'
import { scheduleTokenReset } from '@lib/backdoorToken/BackdoorToken'
import { CHAIN_IDS } from '@config/chain'
import { serverEnv, serverConfig } from '@config/server.env'
import { nodeConfig } from '@config/node.env'
import { problemResponse, rateLimitResponse, noCacheJson } from '@lib/http/response'
import { withCors, handleCors } from '@lib/http/cors'
import { 
  parseFormSubmissionRequest,
  createFormSubmissionSuccess
} from '@schemas/dto/form-submission-gate.dto'
import {
  formatAddress,
  type EmailNotificationResult
} from '@schemas/domain/form-submission-gate.domain'

export const runtime = 'nodejs'            // ensure Node (not Edge) so viem+logs behave
export const dynamic = 'force-dynamic'     // avoid caching surprises in dev

const logger = createLogger('form-submission-gate')

type TokenModelLike = {
  findUnique: (args: { where: { tokenId: number } }) => Promise<{ used?: boolean; usedBy?: string } | null>
  upsert: (args: {
    where: { tokenId: number }
    update: { used: boolean; usedBy: string; usedAt: Date }
    create: { tokenId: number; used: boolean; usedBy: string; usedAt: Date }
  }) => Promise<unknown>
}

/* ---------- local helpers ---------- */

function viemParamsFromChainConfig(cfg: {
  chainId: number
  name: string
  rpcUrl: string
  wssUrl?: string
  explorerUrl?: string
  explorerName?: string
  isTestnet: boolean
}) {
  // Prefer known chain objects for mainnet/sepolia
  if (cfg.chainId === CHAIN_IDS.ethereum) {
    return { chain: mainnet, transport: http(cfg.rpcUrl) }
  }
  if (cfg.chainId === CHAIN_IDS.sepolia) {
    return { chain: sepolia, transport: http(cfg.rpcUrl) }
  }
  // Define a custom chain (e.g., RitoNet/local)
  const chain = defineChain({
    id: cfg.chainId,
    name: cfg.name,
    network: cfg.name.toLowerCase().replace(/\s+/g, '-'),
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: [cfg.rpcUrl] },
      public: { http: [cfg.rpcUrl] },
    },
    blockExplorers: cfg.explorerUrl
      ? { default: { name: cfg.explorerName || 'Explorer', url: cfg.explorerUrl } }
      : undefined,
    testnet: cfg.isTestnet,
  })
  return { chain, transport: http(cfg.rpcUrl) }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getStringProp(obj: unknown, key: string): string | undefined {
  if (obj && typeof obj === 'object' && key in obj) {
    const v = (obj as Record<string, unknown>)[key]
    return typeof v === 'string' ? v : undefined
  }
  return undefined
}

function getStringishProp(obj: unknown, key: string): string | undefined {
  if (obj && typeof obj === 'object' && key in obj) {
    const v = (obj as Record<string, unknown>)[key]
    if (typeof v === 'string') return v
    if (typeof v === 'number') return String(v)
  }
  return undefined
}

function prismaErrorPayload(err: unknown) {
  if (err && typeof err === 'object') {
    const e = err as { name?: unknown; code?: unknown; message?: unknown; meta?: unknown }
    return { name: e?.name, code: e?.code, message: e?.message, meta: e?.meta }
  }
  return { name: undefined, code: undefined, message: String(err), meta: undefined }
}

/**
 * Creates a 405 Method Not Allowed response with proper headers
 */
function methodNotAllowedResponse(method: string): NextResponse {
  return new NextResponse(
    JSON.stringify({
      status: 405,
      type: 'https://httpstatuses.com/405',
      title: 'Method Not Allowed',
      detail: `The ${method} method is not supported for this endpoint. Allowed methods: ${ALLOWED_METHODS_STRING}`
    }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/problem+json',
        'Allow': ALLOWED_METHODS_STRING,
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    }
  )
}

/* ---------- email ---------- */

async function sendEmailViaBrevo(data: {
  tokenId: string
  message: string
  address: string
  timestamp: number
}): Promise<EmailNotificationResult> {
  const log = logger.child({ sub: 'email-brevo' })
  const subject = `Gated Msg by ${data.address.slice(0, 5)}...${data.address.slice(-4)}`
  const htmlContent = `
    <html><body style="font-family: Arial, sans-serif; line-height:1.6;">
      <h2>New Token Gate Message</h2>
      <div style="background:#f4f4f4;padding:20px;border-radius:5px;">
        <p><strong>Token ID:</strong> ${escapeHtml(data.tokenId)}</p>
        <p><strong>From Address:</strong> ${escapeHtml(data.address)}</p>
        <p><strong>Timestamp:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
        <hr style="border:1px solid #ddd;">
        <p><strong>Message:</strong></p>
        <div style="white-space:pre-wrap;background:#fff;padding:15px;border-radius:3px;">
${escapeHtml(data.message)}
        </div>
      </div>
    </body></html>
  `
  const payload = {
    sender: { name: 'RitoSwap Gate', email: SENDER_EMAIL },
    to: [{ email: RECEIVER_EMAIL, name: 'RitoSwap Admin' }],
    subject,
    htmlContent,
    textContent: `Token ID: ${data.tokenId}\nFrom: ${data.address}\nTimestamp: ${new Date(
      data.timestamp
    ).toLocaleString()}\n\nMessage:\n${data.message}`
  }

  const t0 = Date.now()
  try {
    log.info('Sending email via Brevo', {
      to: RECEIVER_EMAIL,
      hasApiKey: !!BREVO_API_KEY,
      tokenId: data.tokenId,
      msgLen: data.message.length
    })
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { accept: 'application/json', 'api-key': BREVO_API_KEY!, 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const text = await res.text()
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      json = { raw: text }
    }
    log.debug('Brevo response', { status: res.status, durationMs: Date.now() - t0 })

    if (!res.ok) {
      const msg = getStringProp(json, 'message') ?? getStringProp(json, 'raw') ?? 'Failed to send email'
      log.warn('Brevo returned non-OK', { status: res.status, error: msg })
      return { success: false, error: msg }
    }
    const messageId = getStringishProp(json, 'messageId')
    log.info('Brevo email sent', { durationMs: Date.now() - t0, messageId })
    return { success: true, messageId }
  } catch (err) {
    log.error('Brevo send failed', { error: (err as Error)?.message })
    return { success: false, error: 'Could not send email' }
  }
}

async function sendEmailViaWorker(data: {
  tokenId: string
  message: string
  address: string
  timestamp: number
}): Promise<EmailNotificationResult> {
  const log = logger.child({ sub: 'email-worker' })
  const t0 = Date.now()
  try {
    log.info('Sending email via Worker', {
      url: CLOUDFLARE_WORKER_URL,
      tokenId: data.tokenId,
      msgLen: data.message.length
    })
    const res = await fetch(CLOUDFLARE_WORKER_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const text = await res.text()
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      json = { raw: text }
    }
    log.debug('Worker response', { status: res.status, durationMs: Date.now() - t0 })

    if (!res.ok) {
      const msg = getStringProp(json, 'error') ?? getStringProp(json, 'raw') ?? 'Worker failed'
      log.warn('Worker returned non-OK', { status: res.status, error: msg })
      return { success: false, error: msg }
    }
    const messageId = getStringishProp(json, 'messageId')
    log.info('Worker email sent', { durationMs: Date.now() - t0, messageId })
    return { success: true, messageId }
  } catch (err) {
    log.error('Worker send failed', { error: (err as Error)?.message })
    return { success: false, error: 'Could not connect to email service' }
  }
}

async function sendEmailNotification(data: {
  tokenId: string
  message: string
  address: string
  timestamp: number
}): Promise<EmailNotificationResult> {
  const log = logger.child({ sub: 'email' })
  const shouldUseWorker = USE_CLOUDFLARE_WORKER && CLOUDFLARE_WORKER_URL
  log.info('Email dispatch decision', {
    mode: shouldUseWorker ? 'worker' : (isProduction ? 'brevo' : 'disabled'),
    isProduction,
    workerConfigured: !!CLOUDFLARE_WORKER_URL,
    brevoConfigured: !!BREVO_API_KEY && !!SENDER_EMAIL && !!RECEIVER_EMAIL
  })

  if (shouldUseWorker) return sendEmailViaWorker(data)
  if (!isProduction) return { success: true, messageId: 'dev-noop' }
  if (!BREVO_API_KEY || !SENDER_EMAIL || !RECEIVER_EMAIL) {
    log.warn('Email service not configured in production')
    return { success: false, error: 'Email service not configured' }
  }
  return sendEmailViaBrevo(data)
}

/* ---------- handler ---------- */

const ALLOWED_METHODS = ['POST', 'OPTIONS']
const ALLOWED_METHODS_STRING = ALLOWED_METHODS.join(', ')

const isProduction = nodeConfig.isProduction
const USE_CLOUDFLARE_WORKER = serverConfig.email.useWorker
const CLOUDFLARE_WORKER_URL = serverConfig.email.workerUrl
const BREVO_API_KEY = serverEnv.BREVO_API_KEY
const SENDER_EMAIL = serverEnv.SENDER_EMAIL
const RECEIVER_EMAIL = serverEnv.RECEIVER_EMAIL

export async function POST(request: NextRequest) {
  const reqId = request.headers.get('x-request-id') || randomUUID()
  const rlog = logger.child({ reqId })
  const startedAt = Date.now()

  // request fingerprint
  const reqHost = getRequestHost(request)
  rlog.info('Request start', {
    path: request.nextUrl.pathname,
    method: request.method,
    host: reqHost,
    ua: request.headers.get('user-agent') || undefined
  })

  // rate limit
  const rlStart = Date.now()
  const rateLimitResult = await checkRateLimitWithNonce(request, 'formSubmissionGate')
  rlog.debug('Rate limit check', {
    durationMs: Date.now() - rlStart,
    success: rateLimitResult.success,
    limit: rateLimitResult.limit,
    remaining: rateLimitResult.remaining,
    bucket: 'formSubmissionGate'
  })

  if (!rateLimitResult.success) {
    rlog.warn('Rate limit exceeded')
    const res = rateLimitResponse(rateLimitResult, 'Rate limit exceeded for form-submission-gate')
    return withCors(res, request)
  }

  // parse and validate body with Zod schema
  let body: unknown
  try {
    const bodyStart = Date.now()
    body = await request.json()
    rlog.debug('Body received', { durationMs: Date.now() - bodyStart })
  } catch (err) {
    rlog.warn('Invalid JSON', { error: (err as Error)?.message })
    const res = problemResponse(400, 'Invalid JSON', 'Could not parse request body')
    return withCors(res, request)
  }

  // Use the parseFormSubmissionRequest helper for validation
  const parseResult = parseFormSubmissionRequest(body)
  if (!parseResult.success) {
    rlog.warn('Validation failed', { error: parseResult.error, field: parseResult.field })
    const res = problemResponse(400, 'Invalid request', parseResult.error)
    return withCors(res, request)
  }

  const { tokenId, message, signature, address, timestamp } = parseResult.data

  // tokenId normalization for BigInt operations
  const tokenIdStr = String(tokenId)
  let tokenIdBigInt: bigint
  try {
    tokenIdBigInt = BigInt(tokenIdStr)
  } catch {
    rlog.warn('Invalid tokenId format', { tokenId })
    const res = problemResponse(400, 'Invalid tokenId format')
    return withCors(res, request)
  }

  if (tokenIdBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
    rlog.warn('Invalid tokenId range (too large)', { tokenIdStr })
    const res = problemResponse(400, 'Invalid tokenId range')
    return withCors(res, request)
  }
  const tokenIdNum = Number(tokenIdStr)

  // legacy (non-SIWE) auth - properly check discriminated union
  const auth = await assertLegacyAuth({
    request,
    address,
    signature,
    tokenId: tokenIdStr,
    timestamp,
    requireAllowlist: false,
    futureLeewayMs: 30_000,
    maxSkewMs: 5 * 60 * 1000
  })

  // Check success property
  if (!auth.success) {
    rlog.warn('Legacy auth failed', { code: auth.code, message: auth.message })
    // Map auth codes to user-facing messages
    const msg =
      auth.code === 'FUTURE_TIMESTAMP'
        ? 'Invalid timestamp - cannot be in the future'
        : auth.code === 'EXPIRED'
        ? 'Signature expired'
        : auth.code === 'HOST_NOT_ALLOWED'
        ? 'Authentication failed'
        : auth.code === 'INVALID_SIGNATURE'
        ? 'Invalid signature'
        : 'Server configuration error'
    const res = problemResponse(auth.status, 'Authentication failed', msg)
    return withCors(res, request)
  }

  // on-chain ownership check
  const chainConfig = getChainConfig()
  const { chain, transport } = viemParamsFromChainConfig(chainConfig)
  const publicClient = createPublicClient({ chain, transport })

  let ownedTokenId: bigint, hasToken: boolean
  const chainStart = Date.now()
  try {
    const result = (await publicClient.readContract({
      address: KEY_TOKEN_ADDRESS,
      abi: fullKeyTokenAbi,
      functionName: 'getTokenOfOwner',
      args: [address as `0x${string}`]
    })) as [bigint, boolean]
    ;[ownedTokenId, hasToken] = result
    rlog.debug('On-chain ownership', {
      durationMs: Date.now() - chainStart,
      hasToken,
      ownedTokenId: ownedTokenId?.toString(),
      requestedTokenId: tokenIdStr
    })
  } catch (err) {
    rlog.error('On-chain read failed', { error: (err as Error)?.message })
    const res = problemResponse(500, 'Failed to verify token ownership')
    return withCors(res, request)
  }

  if (!hasToken || ownedTokenId !== tokenIdBigInt) {
    rlog.warn('Token ownership mismatch', {
      address: formatAddress(address),
      expected: tokenIdStr,
      owned: ownedTokenId?.toString(),
      hasToken
    })
    const res = problemResponse(403, 'You do not own this token')
    return withCors(res, request)
  }

  // DB checks: reject if used; then mark used
  const tokenModel = getTokenModel()
  const tokenClient = tokenModel as unknown as TokenModelLike
  try {
    const existing = await tokenClient.findUnique({ where: { tokenId: tokenIdNum } })
    rlog.debug('DB findUnique', { found: !!existing, used: !!existing?.used, tokenId: tokenIdNum })
    if (existing?.used) {
      rlog.warn('Token already used', { tokenId: tokenIdNum, usedBy: formatAddress(existing.usedBy || '') })
      const res = problemResponse(403, 'This token has already been used')
      return withCors(res, request)
    }
  } catch (err) {
    rlog.error('DB findUnique failed', { detail: prismaErrorPayload(err) })
    const res = problemResponse(
      500,
      'Database error',
      isProduction ? undefined : 'DB findUnique failed'
    )
    return withCors(res, request)
  }

  // email dispatch
  if (isProduction) {
    const emailStart = Date.now()
    const emailResult = await sendEmailNotification({
      tokenId: tokenIdStr,
      message,
      address,
      timestamp
    })
    if (!emailResult.success) {
      rlog.error('Email dispatch failed', { durationMs: Date.now() - emailStart, error: emailResult.error })
      const res = problemResponse(500, 'Failed to process submission', emailResult.error)
      return withCors(res, request)
    }
    rlog.info('Email dispatched', { durationMs: Date.now() - emailStart, messageId: emailResult.messageId })
  } else {
    rlog.debug('Email skipped (not production)')
  }

  // mark token used
  const upsertStart = Date.now()
  try {
    await tokenClient.upsert({
      where: { tokenId: tokenIdNum },
      update: { used: true, usedBy: address, usedAt: new Date() },
      create: { tokenId: tokenIdNum, used: true, usedBy: address, usedAt: new Date() }
    })
    rlog.info('Token marked used', {
      tokenId: tokenIdNum,
      address: formatAddress(address),
      durationMs: Date.now() - upsertStart
    })

    // BACKDOOR: Schedule token reset if conditions are met
    await scheduleTokenReset(tokenIdNum, address, reqId)
  } catch (err) {
    rlog.error('DB upsert failed', { detail: prismaErrorPayload(err) })
    const res = problemResponse(
      500,
      'Database error',
      isProduction ? undefined : 'DB upsert failed'
    )
    return withCors(res, request)
  }

  // Use DTO helper for success response
  const successResponse = createFormSubmissionSuccess()
  rlog.info('Access granted', {
    tokenId: tokenIdNum,
    address: formatAddress(address),
    totalDurationMs: Date.now() - startedAt
  })
  return withCors(noCacheJson(successResponse), request)
}

// Preflight support (CORS)
export function OPTIONS(request: NextRequest) {
  return handleCors(request) ?? new NextResponse(null, { status: 204 })
}

// Method Not Allowed handlers for unsupported HTTP methods
export function GET(request: NextRequest) {
  logger.warn('Method not allowed', { method: 'GET', path: request.nextUrl.pathname })
  return withCors(methodNotAllowedResponse('GET'), request)
}

export function PUT(request: NextRequest) {
  logger.warn('Method not allowed', { method: 'PUT', path: request.nextUrl.pathname })
  return withCors(methodNotAllowedResponse('PUT'), request)
}

export function DELETE(request: NextRequest) {
  logger.warn('Method not allowed', { method: 'DELETE', path: request.nextUrl.pathname })
  return withCors(methodNotAllowedResponse('DELETE'), request)
}

export function PATCH(request: NextRequest) {
  logger.warn('Method not allowed', { method: 'PATCH', path: request.nextUrl.pathname })
  return withCors(methodNotAllowedResponse('PATCH'), request)
}

export function HEAD(request: NextRequest) {
  logger.warn('Method not allowed', { method: 'HEAD', path: request.nextUrl.pathname })
  return withCors(methodNotAllowedResponse('HEAD'), request)
}
