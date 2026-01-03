// app/api/gate-access/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyMessage, recoverMessageAddress, createPublicClient, http, defineChain } from 'viem'
import { mainnet, sepolia } from 'viem/chains'

import { getTokenModel, getChainConfig } from '@lib/prisma/prismaNetworkUtils'
import { fullKeyTokenAbi, KEY_TOKEN_ADDRESS } from '@config/contracts'
import { checkRateLimitWithNonce, getIdentifier } from '@lib/rateLimit/rateLimit.server'
import { isSiweEnabled, verifySiweMessage, verifyNonce, getDomain as getSiweDomain } from '@lib/siwe/siwe.server'
import { getGatedContent } from '@lib/server/gatedContent'
import { createLogger } from '@logger'
import {
  assertLegacyAuth,
  normalizeHost,
  getRequestHost,
  getAllowedDomains,
  buildLegacyExpectedMessage,
} from '@lib/auth/nonSiweAuth'
import { CHAIN_IDS, getChainConfig as getStaticChainConfig } from '@config/chain'
import { withCors, handleCors } from '@lib/http/cors'
import { noCacheJson, problemResponse, rateLimitResponse } from '@lib/http/response'

// JWT libs (new)
import { readBearerFromRequest, verifyAccessToken, signAccessToken } from '@lib/jwt/server'
import { buildAccessClaims, legacyProjection } from '@lib/jwt/claims'
import { jwtServerConfig } from '@config/jwt.server'

// Schemas / DTOs
import {
  GateAccessRequestSchema,
  GateAccessSuccessResponseSchema,
  isGateAccessSiweRequest,
  isGateAccessLegacyRequest,
  type GateAccessRequestDTO,
  type GateAccessSuccessResponseDTO,
} from '@schemas/dto/gate-access.dto'
import type { SiweVerificationParams } from '@schemas/domain/siwe.domain'
import type { NonceVerificationParams } from '@schemas/domain/nonce.domain'

const logger = createLogger('gate-access-api')

// Consistent error message for all auth failures to prevent oracle attacks
const AUTH_ERROR_MESSAGE = 'Authentication failed'

// Allowed HTTP methods for this endpoint
const ALLOWED_METHODS = ['POST', 'OPTIONS']

// Narrow JSON-like content we spread into the response
type JsonObject = Record<string, unknown>

/* ---------- viem adapter ---------- */
function viemParamsFromChainConfig(cfg: {
  chainId: number
  name: string
  rpcUrl: string
  wssUrl?: string
  explorerUrl?: string
  explorerName?: string
  isTestnet: boolean
}) {
  if (cfg.chainId === CHAIN_IDS.ethereum) {
    return { chain: mainnet, transport: http(cfg.rpcUrl) }
  }
  if (cfg.chainId === CHAIN_IDS.sepolia) {
    return { chain: sepolia, transport: http(cfg.rpcUrl) }
  }
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

/* ---------- helpers ---------- */
async function safeJsonClone(req: NextRequest): Promise<unknown | null> {
  try {
    return await req.clone().json()
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  logger.info('Request started')

  // 1) Rate limit (uniform regardless of auth mode)
  const rateLimitResult = await checkRateLimitWithNonce(request, 'gateAccess')
  logger.debug('Rate limit check', { result: rateLimitResult })
  if (!rateLimitResult.success) {
    logger.warn('Rate limit exceeded', { limit: rateLimitResult.limit, remaining: rateLimitResult.remaining })
    const res = rateLimitResponse(rateLimitResult, 'Rate limit exceeded for gate access')
    return withCors(res, request)
  }

  // --- Variables we will fill across branches ---
  let authMode: 'jwt' | 'siwe' | 'legacy' | null = null
  let address: `0x${string}` | undefined
  let tokenIdStr: string | undefined
  let siweMessageForHash: string | undefined // SIWE text or legacy expected message (for JWT hash)
  let siweProjection:
    | {
        address: string
        domain: string
        chainId: number
        nonce: string
        issuedAt: string
        notBefore?: string
        expirationTime?: string
        resources?: string[]
      }
    | undefined

  // 2) Try JWT (Authorization: Bearer) first
  const bearer = readBearerFromRequest(request)
  if (bearer) {
    try {
      const { payload } = await verifyAccessToken(bearer)
      authMode = 'jwt'
      address = payload.sub
      const body = await safeJsonClone(request)
      let bodyTokenId: string | undefined
      if (body && typeof body === 'object' && 'tokenId' in body) {
        const v = (body as { tokenId?: unknown }).tokenId
        bodyTokenId = v !== undefined ? String(v) : undefined
      }
      const jwtTokenId = payload.tokenId
      tokenIdStr = (bodyTokenId ?? jwtTokenId) || undefined

      if (!tokenIdStr || !/^\d+$/.test(tokenIdStr)) {
        logger.warn('JWT path missing/invalid tokenId')
        const res = problemResponse(400, 'Invalid tokenId')
        return withCors(res, request)
      }
      if (bodyTokenId && jwtTokenId && bodyTokenId !== jwtTokenId) {
        logger.warn('JWT/body tokenId mismatch', { bodyTokenId, jwtTokenId })
        const res = problemResponse(401, AUTH_ERROR_MESSAGE)
        return withCors(res, request)
      }

      logger.debug('JWT accepted', { sub: address, tokenId: tokenIdStr })
    } catch (e) {
      logger.warn('JWT verify failed; falling back to body auth', { error: (e as Error)?.message })
      authMode = null // continue below
    }
  }

  // 3) If no valid JWT, parse body and do SIWE/Legacy verification
  let dto: GateAccessRequestDTO | undefined

  if (!authMode) {
    // Parse & validate request body with schema
    try {
      const body = await request.json()
      const parsed = GateAccessRequestSchema.parse(body)
      dto = parsed
      logger.debug('Request body validated', {
        address: parsed.address,
        tokenId: parsed.tokenId,
        isSiwe: isGateAccessSiweRequest(parsed),
        isLegacy: isGateAccessLegacyRequest(parsed),
      })
    } catch (error) {
      logger.error('Request validation error', {
        error: error instanceof Error ? error.message : String(error),
      })
      const res = problemResponse(400, 'Invalid request', 'Request body validation failed')
      return withCors(res, request)
    }

    // Extract common fields
    const { address: bodyAddress, signature, tokenId } = dto!
    address = bodyAddress.toLowerCase() as `0x${string}`
    tokenIdStr = String(tokenId)

    // Determine auth mode
    const siweEnabledFlag = isSiweEnabled()
    const isSiweRequest = isGateAccessSiweRequest(dto)
    const isLegacyRequest = isGateAccessLegacyRequest(dto)
    logger.debug('Authentication check', { siweEnabled: siweEnabledFlag, isSiweRequest, isLegacyRequest })

    if (siweEnabledFlag) {
      // ---- SIWE required when enabled ----
      if (!isSiweRequest) {
        logger.warn('SIWE required but legacy request received')
        const res = problemResponse(401, AUTH_ERROR_MESSAGE)
        return withCors(res, request)
      }

      const { message, nonce } = dto as { message: string; nonce: string }
      const identifier = getIdentifier(request)

      // Verify nonce
      const nonceParams: NonceVerificationParams = { identifier, nonce }
      const nonceResult = await verifyNonce(nonceParams)
      logger.debug('Nonce verification', { valid: nonceResult.isValid, reason: nonceResult.reason })
      if (!nonceResult.isValid) {
        logger.warn('Invalid or expired nonce', { identifier, nonce, reason: nonceResult.reason })
        const res = problemResponse(401, AUTH_ERROR_MESSAGE)
        return withCors(res, request)
      }

      // Allowed domains must be configured
      const allowedDomains = getAllowedDomains()
      if (allowedDomains.length === 0) {
        logger.error('NEXT_PUBLIC_DOMAIN not configured or empty')
        const res = problemResponse(500, 'Server configuration error')
        return withCors(res, request)
      }

      // Spec-compliant SIWE verification
      logger.debug('Verifying SIWE message')
      const siweParams: SiweVerificationParams = {
        message,
        signature: signature as `0x${string}`,
        nonce,
        address: address as `0x${string}`,
        requestHeaders: request.headers,
      }
      const siweResult = await verifySiweMessage(siweParams)
      logger.debug('SIWE verification result', { success: siweResult.success })
      if (!siweResult.success) {
        // Extra diagnostics
        try {
          const expectedDomain = getSiweDomain(request.headers)
          const reqHost = getRequestHost(request)
          const host = request.headers.get('host')
          const xfh = request.headers.get('x-forwarded-host')
          let recovered: string | undefined
          try {
            recovered = await recoverMessageAddress({ message, signature: signature as `0x${string}` })
          } catch (e) {
            recovered = `recover-error: ${(e as Error)?.message || String(e)}`
          }
          logger.error('SIWE debug mismatch', {
            dtoAddress: address,
            msgAddress: siweResult.parsed?.address,
            recoveredAddress: recovered,
            expectedDomain,
            reqHost,
            headers: { host, 'x-forwarded-host': xfh },
          })
        } catch (e) {
          logger.error('SIWE debug logging failed', { error: (e as Error)?.message || String(e) })
        }

        logger.warn('SIWE verification failed', { error: siweResult.error })
        const res = problemResponse(401, AUTH_ERROR_MESSAGE)
        return withCors(res, request)
      }

      // Policy checks: domain and host allowlist + address match
      const reqHost = getRequestHost(request)
      const siweDomain = normalizeHost(siweResult.parsed!.domain)
      const siweAddress = siweResult.parsed!.address.toLowerCase()
      const addressMatches = siweAddress === address
      const siweDomainAllowed = !!siweDomain && getAllowedDomains().includes(siweDomain)
      const reqHostAllowed = !!reqHost && getAllowedDomains().includes(reqHost)

      logger.debug('Domain/address check', {
        allowedDomains: getAllowedDomains(),
        siweDomain,
        reqHost,
        addressMatches,
        siweDomainAllowed,
        reqHostAllowed,
      })

      if (!addressMatches || !siweDomainAllowed || !reqHostAllowed) {
        // DEBUG info
        const host = request.headers.get('host')
        const xfh = request.headers.get('x-forwarded-host')
        logger.error('SIWE policy mismatch', {
          dtoAddress: address,
          parsedAddress: siweAddress,
          siweDomain,
          reqHost,
          allowedDomains: getAllowedDomains(),
          headers: { host, 'x-forwarded-host': xfh },
        })
        logger.warn('Domain/address mismatch', { reason: { addressMatches, siweDomainAllowed, reqHostAllowed } })
        const res = problemResponse(401, AUTH_ERROR_MESSAGE)
        return withCors(res, request)
      }

      // Extra cryptographic verification (viem)
      logger.debug('Verifying signature with viem')
      const viemVerifyResult = await verifyMessage({
        address: address as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      })
      logger.debug('Viem signature verification', { valid: viemVerifyResult })
      if (!viemVerifyResult) {
        logger.warn('Invalid signature', { address })
        const res = problemResponse(401, AUTH_ERROR_MESSAGE)
        return withCors(res, request)
      }

      // Validate chain ID matches expected
      const expectedChainId = getStaticChainConfig().chainId
      if (siweResult.parsed!.chainId !== expectedChainId) {
        logger.warn('SIWE chain ID mismatch', {
          expected: expectedChainId,
          received: siweResult.parsed!.chainId,
        })
        const res = problemResponse(401, AUTH_ERROR_MESSAGE)
        return withCors(res, request)
      }

      // Prepare for minting JWT later
      authMode = 'siwe'
      siweMessageForHash = message
      siweProjection = {
        address,
        domain: siweResult.parsed!.domain,
        chainId: siweResult.parsed!.chainId,
        nonce: siweResult.parsed!.nonce,
        issuedAt: siweResult.parsed!.issuedAt,
        notBefore: siweResult.parsed!.notBefore,
        expirationTime: siweResult.parsed!.expirationTime,
      }
    } else {
      // ---- Legacy (non-SIWE) path ----
      if (!isLegacyRequest) {
        logger.warn('Legacy auth required but SIWE request received')
        const res = problemResponse(400, 'SIWE not configured on server')
        return withCors(res, request)
      }

      const { timestamp } = dto as { timestamp: number }

      const auth = await assertLegacyAuth({
        request,
        address,
        signature,
        tokenId: tokenIdStr!,
        timestamp,
        requireAllowlist: true,
        futureLeewayMs: 0,
        maxSkewMs: 5 * 60 * 1000,
      })

      if (!auth.success) {
        // DEBUG diagnostics
        try {
          const reqHost = getRequestHost(request)
          const headers = {
            host: request.headers.get('host'),
            'x-forwarded-host': request.headers.get('x-forwarded-host'),
          }
          const chainId = getStaticChainConfig().chainId
          const expectedMessage = buildLegacyExpectedMessage({
            tokenId: tokenIdStr!,
            reqHost,
            path: request.nextUrl.pathname,
            method: (request.method || 'POST').toUpperCase(),
            chainId,
            timestamp,
          })
          let recovered: string | undefined
          try {
            recovered = await recoverMessageAddress({ message: expectedMessage, signature: signature as `0x${string}` })
          } catch (e) {
            recovered = `recover-error: ${(e as Error)?.message || String(e)}`
          }

          logger.error('Legacy debug mismatch', {
            code: (auth as { code?: unknown }).code,
            dtoAddress: address,
            recoveredAddress: recovered,
            reqHost,
            chainId,
            allowedDomains: getAllowedDomains(),
            headers,
            expectedMessage,
          })
        } catch (e) {
          logger.error('Legacy debug logging failed', { error: (e as Error)?.message || String(e) })
        }

        const authCode =
          typeof (auth as { code?: unknown }).code === 'string' || typeof (auth as { code?: unknown }).code === 'number'
            ? (auth as { code: string | number }).code
            : undefined
        logger.warn('Legacy auth failed', { code: authCode })
        const status =
          typeof (auth as { status?: unknown }).status === 'number' ? (auth as { status: number }).status : 401
        const res = problemResponse(status, AUTH_ERROR_MESSAGE)
        return withCors(res, request)
      }

      logger.debug('Legacy auth succeeded', { reqHost: auth.reqHost, chainId: auth.chainId })

      // Prepare for minting JWT later
      authMode = 'legacy'
      siweMessageForHash = auth.expectedMessage
      // SIWE-like projection from legacy inputs
      siweProjection = legacyProjection({
        address,
        domain: auth.reqHost,
        chainId: auth.chainId,
        issuedAtMs: timestamp,
      })
    }
  }

  // 4) tokenId numeric format sanity
  let tokenIdBigInt: bigint
  try {
    tokenIdBigInt = BigInt(tokenIdStr!)
  } catch {
    logger.error('Invalid tokenId format', { tokenId: tokenIdStr })
    const res = problemResponse(400, 'Invalid tokenId format')
    return withCors(res, request)
  }

  // 5) On-chain ownership check
  logger.info('Checking on-chain ownership')
  const chainConfig = getChainConfig()
  const { chain, transport } = viemParamsFromChainConfig(chainConfig)
  const publicClient = createPublicClient({ chain, transport })

  const [ownedTokenId, hasToken] = (await publicClient.readContract({
    address: KEY_TOKEN_ADDRESS,
    abi: fullKeyTokenAbi,
    functionName: 'getTokenOfOwner',
    args: [address as `0x${string}`],
  })) as [bigint, boolean]

  logger.debug('On-chain ownership check', {
    ownedTokenId: ownedTokenId.toString(),
    hasToken,
    requestedTokenId: tokenIdStr,
  })

  if (!hasToken || ownedTokenId !== tokenIdBigInt) {
    logger.warn('Token ownership verification failed', {
      address,
      tokenId: tokenIdStr,
      ownedTokenId: ownedTokenId.toString(),
      hasToken,
    })
    const res = problemResponse(403, 'You do not own this token')
    return withCors(res, request)
  }

  // 6) Database usage check
  logger.debug('Checking token usage in database')
  const tokenModel = getTokenModel()
  const tokenRecord = await tokenModel.findUnique({ where: { tokenId: Number(tokenIdStr) } })
  logger.debug('Token record', { found: !!tokenRecord, used: tokenRecord?.used })

  if (!tokenRecord) {
    logger.error('Token not found in database', { tokenId: tokenIdStr })
    const res = problemResponse(404, 'Token not found in database')
    return withCors(res, request)
  }
  if (tokenRecord.used) {
    logger.warn('Token already used', { tokenId: tokenIdStr })
    const res = problemResponse(403, 'This token has already been used')
    return withCors(res, request)
  }

  // 7) Generate gated content
  logger.info('Generating gated content')
  const startTime = Date.now()
  let content: JsonObject
  let audioError = false

  try {
    content = (await getGatedContent()) as JsonObject
    logger.info('Gated content generated', { durationMs: Date.now() - startTime })
  } catch (contentError) {
    logger.error('Failed to generate gated content', {
      error: contentError instanceof Error ? contentError.message : String(contentError),
    })

    try {
      content = {
        welcomeText: 'Welcome, esteemed key holder!',
        textSubmissionAreaHtml: "<div class='submission-area'>Submit your exclusive content</div>",
        audioData: {
          headline: 'Exclusive Audio',
          imageSrc: '/audio-placeholder.jpg',
          imageAlt: 'Audio unavailable',
          description: 'Audio content temporarily unavailable',
          title: 'Token Holder Audio',
          audioSrc: '',
          error: true,
        },
        styles: '.submission-area { padding: 20px; }',
        script: "console.log('Loaded without audio');",
      }
      audioError = true
      logger.warn('Using fallback content without audio')
    } catch (fallbackError) {
      logger.error('Failed to generate fallback content', {
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      })
      const res = problemResponse(500, 'Failed to generate content')
      return withCors(res, request)
    }
  }

  // 8) Mint access JWT (only when we authenticated with SIWE or Legacy in this call)
  let accessToken: string | undefined
  if (authMode === 'siwe' || authMode === 'legacy') {
    try {
      const claims = buildAccessClaims({
        auth: authMode,
        siweParsed: siweProjection!,
        originalSiweMessage: siweMessageForHash!,
        issuer: jwtServerConfig.issuer,
        audiences: jwtServerConfig.audiences,
        accessTtlSec: jwtServerConfig.accessTtlSec,
        scopes: ['gate:read'],
        tokenId: tokenIdStr!,
      })
      accessToken = await signAccessToken(claims)
    } catch (e) {
      // Should not fail under normal circumstances; but don't block content if it does
      logger.error('Failed to mint access token', { error: (e as Error)?.message })
    }
  }

  // 9) Validate and return response (include accessToken when minted)
  const responseData: GateAccessSuccessResponseDTO = GateAccessSuccessResponseSchema.parse({
    success: true,
    access: 'granted',
    content: {
      ...content,
      ...(audioError ? { audioError: true, errorMessage: 'Audio temporarily unavailable' } : {}),
    },
    ...(accessToken ? { accessToken } : {}),
  })

  logger.info('Access granted successfully', { address, tokenId: tokenIdStr, audioError, authMode })
  const res = noCacheJson(responseData)
  return withCors(res, request)
}

// Preflight support with CORS headers
export function OPTIONS(request: NextRequest) {
  return handleCors(request) ?? new NextResponse(null, { status: 204 })
}

// Handle unsupported methods (GET, PUT, DELETE, PATCH, HEAD, etc.)
function handleMethodNotAllowed(request: NextRequest) {
  logger.warn('Method not allowed', { method: request.method })

  const res = new NextResponse(
    JSON.stringify({
      error: 'Method Not Allowed',
      message: `The ${request.method} method is not allowed for this endpoint`,
      allowedMethods: ALLOWED_METHODS,
    }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Allow': ALLOWED_METHODS.join(', '),
      },
    },
  )

  return withCors(res, request)
}

export const GET = handleMethodNotAllowed
export const PUT = handleMethodNotAllowed
export const DELETE = handleMethodNotAllowed
export const PATCH = handleMethodNotAllowed
export const HEAD = handleMethodNotAllowed
