/* app/api/token-status/[tokenId]/route.ts */
import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, defineChain } from 'viem'
import { mainnet, sepolia } from 'viem/chains'
import { fullKeyTokenAbi, KEY_TOKEN_ADDRESS } from '@config/contracts'
import { getTokenModel, getChainConfig, prisma } from '@lib/prisma/prismaNetworkUtils'
import { checkRateLimitWithNonce } from '@lib/rateLimit/rateLimit.server'
import { createLogger } from '@logger'
import { CHAIN_IDS, getActiveChain } from '@config/chain'
import { withCors, handleCors } from '@lib/http/cors'
import { 
  problemResponse, 
  rateLimitResponse, 
  validateResponse 
} from '@lib/http/response'
import { 
  parseTokenIdParam, 
  createTokenStatusResponse,
  TokenStatusResponseSchema
} from '@schemas/dto/token-status.dto'

const logger = createLogger('token-status-api')

type TokenRow = { used?: boolean; usedBy?: string | null; usedAt?: Date | null }

type TokenModelLike = {
  findUnique: (args: { where: { tokenId: number } }) => Promise<TokenRow | null>
  upsert: (args: {
    where: { tokenId: number }
    update: Record<string, unknown>
    create: { tokenId: number; used: boolean }
  }) => Promise<TokenRow>
}

/* ---------- viem adapter (Option 2) ---------- */
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

export async function GET(
  request: NextRequest,
  { params }: { params: { tokenId: string } }
) {
  // Validate token ID using Zod schema
  const parseResult = parseTokenIdParam(params);
  
  if (!parseResult.success) {
    const response = problemResponse(
      400,
      'Invalid token ID',
      parseResult.error
    );
    return withCors(response, request);
  }

  const tokenId = parseResult.tokenId;
  const tokenIdStr = String(tokenId);
  const tokenIdNum = Number(tokenIdStr);

  // Rate limiting check (no global cap for polling endpoint)
  const rateLimitResult = await checkRateLimitWithNonce(request, 'tokenStatus', false);
  
  if (!rateLimitResult.success) {
    const response = rateLimitResponse(
      rateLimitResult,
      'Rate limit exceeded for token-status'
    );
    logger.warn('Rate limit exceeded', {
      tokenId,
      limit: rateLimitResult.limit,
      remaining: rateLimitResult.remaining
    });
    return withCors(response, request);
  }

  try {
    // Chain config → Viem client
    const chainConfig = getChainConfig();
    const { chain, transport } = viemParamsFromChainConfig(chainConfig);
    const publicClient = createPublicClient({ chain, transport });

    // Get token model
    let tokenModel: TokenModelLike;
    try {
      tokenModel = getTokenModel() as unknown as TokenModelLike;
    } catch (e) {
      // Fallback to per-chain delegate
      const active = getActiveChain();
      const suffix = active.charAt(0).toUpperCase() + active.slice(1);
      const candidate = (prisma as unknown as Record<string, unknown>)[`token${suffix}`];
      if (!candidate || typeof candidate !== 'object') throw e;
      const delegate = candidate as Partial<TokenModelLike>;
      if (typeof delegate.findUnique !== 'function' || typeof delegate.upsert !== 'function') throw e;
      tokenModel = delegate as TokenModelLike;
    }

    // Check database for token usage status
    logger.debug('Looking for token', { tokenId, type: typeof tokenId });
    let token = await tokenModel.findUnique({ where: { tokenId: tokenIdNum } });
    logger.debug('Database result', { found: !!token, used: token?.used });

    if (token) {
      // Token exists in DB - return usage status
      logger.info('Token found in database', { tokenId });
      
      const responseData = createTokenStatusResponse(
        true,
        !!token.used,
        token.usedBy ?? null,
        token.usedAt ?? null
      );
      
      // Validate response against schema
      const validatedResponse = validateResponse(
        TokenStatusResponseSchema,
        responseData,
        'Token status response validation failed'
      );
      
      const response = NextResponse.json(
        validatedResponse,
        {
          headers: {
            // Cache success responses briefly to reduce polling load
            'Cache-Control': 'public, max-age=3, s-maxage=3',
          },
        }
      );
      
      return withCors(response, request);
    }

    // Not in DB → verify on-chain existence via tokenURI
    const tokenIdBigInt = BigInt(tokenIdStr);

    try {
      await publicClient.readContract({
        address: KEY_TOKEN_ADDRESS,
        abi: fullKeyTokenAbi,
        functionName: 'tokenURI',
        args: [tokenIdBigInt],
      });

      // Token exists on-chain - add to DB as unused
      token = await tokenModel.upsert({
        where: { tokenId: tokenIdNum },
        update: {},
        create: { tokenId: tokenIdNum, used: false },
      });

      logger.info('Token exists on-chain, added to database', { tokenId });
      
      const responseData = createTokenStatusResponse(true, false, null, null);
      const validatedResponse = validateResponse(
        TokenStatusResponseSchema,
        responseData,
        'Token status response validation failed'
      );
      
      const response = NextResponse.json(
        validatedResponse,
        {
          headers: {
            'Cache-Control': 'public, max-age=3, s-maxage=3',
          },
        }
      );
      
      return withCors(response, request);
    } catch {
      // Token doesn't exist on-chain
      logger.debug('Token does not exist on-chain', { tokenId });
      
      const responseData = createTokenStatusResponse(false, false, null, null);
      const validatedResponse = validateResponse(
        TokenStatusResponseSchema,
        responseData,
        'Token status response validation failed'
      );
      
      const response = NextResponse.json(
        validatedResponse,
        {
          headers: {
            'Cache-Control': 'public, max-age=3, s-maxage=3',
          },
        }
      );
      
      return withCors(response, request);
    }
  } catch (error) {
    logger.error('Error checking token status', {
      error: error instanceof Error ? error.message : String(error),
      tokenId
    });
    
    const response = problemResponse(
      500,
      'Failed to check token status',
      'An unexpected error occurred while checking token status'
    );
    
    return withCors(response, request);
  }
}

// Handle other HTTP methods
export async function POST(request: NextRequest) {
  const response = NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
  return withCors(response, request);
}

export async function PUT(request: NextRequest) {
  const response = NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
  return withCors(response, request);
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
  return withCors(response, request);
}

export async function PATCH(request: NextRequest) {
  const response = NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
  return withCors(response, request);
}

// Preflight support with CORS headers
export function OPTIONS(request: NextRequest) {
  return handleCors(request) ?? new NextResponse(null, { status: 204 });
}
