/**
 * Custom React Query hook for fetching & caching ERC-20 and NFT assets
 * with infinite pagination, prefetching, and cache invalidation.
 */

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import type { TokenType } from '../components/selection/SelectToken'
import type { ERC20Asset, NFTAsset } from '../components/assets/AssetDisplay'
import { publicEnv } from '@config/public.env'
import { createPublicClient, http, type Address } from 'viem'
import { CHAIN_IDS } from '@config/chain'
import { KEY_TOKEN_ADDRESS, fullKeyTokenAbi } from '@config/contracts'

const ALCHEMY_API_KEY = publicEnv.NEXT_PUBLIC_ALCHEMY_API_KEY ?? ''

// Alchemy RPC endpoints for ERC-20 token balances & metadata
const ALCHEMY_RPC_URLS: Record<number, string> = {
  1: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  137: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  42161: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  43114: `https://avax-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  8453: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  10: `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  250: `https://fantom-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  11155111: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
}

// Alchemy NFT API v3 endpoints
const ALCHEMY_NFT_API_URLS: Record<number, string> = {
  1: `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`,
  137: `https://polygon-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`,
  42161: `https://arb-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`,
  8453: `https://base-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`,
  10: `https://opt-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`,
  11155111: `https://eth-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`,
}

interface AssetPage {
  assets: (ERC20Asset | NFTAsset)[]
  pageKey: string | null
}

interface UseAssetsParams {
  address: string
  chainId: number
  tokenType: TokenType
  enabled?: boolean
}

export interface UseAssetsResult {
  assets: (ERC20Asset | NFTAsset)[]
  totalCount: number
  isLoading: boolean
  isError: boolean
  error: Error | null
  fetchNextPage: () => Promise<void>
  hasNextPage: boolean
  isFetchingNextPage: boolean
  refetch: () => Promise<void>
  prefetch: () => Promise<void>
  clearCache: () => void
}

/** Minimal shapes for external API responses to avoid `any`. */
type TokenBalanceEntry = { contractAddress: string; tokenBalance?: string | null }
type TokenMetadata = { name?: string; symbol?: string; decimals?: number; logo?: string }
type AlchemyOwnedNft = {
  tokenId?: string
  contract?: { address?: string; name?: string; tokenType?: 'ERC721' | 'ERC1155' | string }
  name?: string
  description?: string
  balance?: string | number
  image?: { cachedUrl?: string; originalUrl?: string; pngUrl?: string; thumbnailUrl?: string }
  media?: Array<{ gateway?: string; thumbnail?: string; raw?: string }>
  metadata?: { image?: string; image_url?: string }
  raw?: { metadata?: { image?: string; image_url?: string; description?: string; attributes?: unknown[] } }
  rawMetadata?: { attributes?: unknown[] }
}

/** Attributes shape expected by `NFTAsset`. */
type NFTAttribute = { trait_type: string; value: string | number }

/** Normalize arbitrary attribute arrays into the expected shape. */
function normalizeAttributes(attrs: unknown): NFTAttribute[] {
  if (!Array.isArray(attrs)) return []
  const out: NFTAttribute[] = []
  for (const item of attrs) {
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>
      const traitRaw = obj.trait_type ?? obj.traitType ?? obj.type ?? obj.trait
      const valueRaw = obj.value ?? obj.trait_value ?? obj.display_value ?? obj.val
      const trait = typeof traitRaw === 'string' ? traitRaw : undefined
      let value: string | number | undefined
      if (typeof valueRaw === 'string' || typeof valueRaw === 'number') {
        value = valueRaw
      } else if (valueRaw != null) {
        value = String(valueRaw)
      }
      if (trait && value !== undefined) out.push({ trait_type: trait, value })
    }
  }
  return out
}

function decodeBase64ToString(base64: string): string {
  const g = globalThis as unknown as {
    atob?: (data: string) => string
    Buffer?: { from: (input: string, encoding: string) => { toString: (enc: string) => string } }
  }

  if (typeof g !== 'undefined' && typeof g.atob === 'function') {
    return g.atob(base64)
  }
  // Node/Vitest fallback (avoid hard dependency in the browser bundle)
  const BufferCtor = g.Buffer
  if (BufferCtor?.from) return BufferCtor.from(base64, 'base64').toString('utf-8')
  throw new Error('Base64 decoding not supported in this environment')
}

function parseDataJsonTokenUri(tokenUri: string): {
  name?: string
  description?: string
  image?: string
  attributes?: NFTAttribute[]
} | null {
  const prefix = 'data:application/json;base64,'
  if (!tokenUri.startsWith(prefix)) return null

  const base64 = tokenUri.slice(prefix.length)
  const json = decodeBase64ToString(base64)
  const parsed: unknown = JSON.parse(json)
  if (!parsed || typeof parsed !== 'object') return null

  const obj = parsed as Record<string, unknown>
  return {
    name: typeof obj.name === 'string' ? obj.name : undefined,
    description: typeof obj.description === 'string' ? obj.description : undefined,
    image: typeof obj.image === 'string' ? obj.image : undefined,
    attributes: normalizeAttributes(obj.attributes),
  }
}

async function fetchRitonetKeyNftAssets(address: string): Promise<AssetPage> {
  const rpcUrl = publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_RPC
  if (!rpcUrl) throw new Error('RitoNet RPC not configured')

  const publicClient = createPublicClient({ transport: http(rpcUrl) })
  const tokenIds = (await publicClient.readContract({
    address: KEY_TOKEN_ADDRESS,
    abi: fullKeyTokenAbi,
    functionName: 'tokensOfOwner',
    args: [address as Address],
  })) as readonly bigint[]

  const assets = await Promise.all(
    [...tokenIds]
      .sort((a, b) => (a > b ? 1 : a < b ? -1 : 0))
      .map<Promise<NFTAsset>>(async (tokenId) => {
        const tokenUri = (await publicClient.readContract({
          address: KEY_TOKEN_ADDRESS,
          abi: fullKeyTokenAbi,
          functionName: 'tokenURI',
          args: [tokenId],
        })) as string

        const meta = parseDataJsonTokenUri(tokenUri)
        const name = meta?.name ?? `Token #${tokenId.toString()}`
        const description = meta?.description
        const image = meta?.image
        const attributes = meta?.attributes ?? []

        return {
          tokenId: tokenId.toString(),
          contractAddress: KEY_TOKEN_ADDRESS,
          name,
          description,
          image,
          attributes,
          balance: '1',
        }
      })
  )

  return { assets, pageKey: null }
}

/**
 * useAssets: infinite‐scroll + cache + retry + prefetch + clearCache.
 */
export function useAssets({
  address,
  chainId,
  tokenType,
  enabled = true,
}: UseAssetsParams): UseAssetsResult {
  const queryClient = useQueryClient()
  const queryKey = ['assets', address.toLowerCase(), chainId, tokenType] as const

  const query = useInfiniteQuery<AssetPage, Error>({
    queryKey,
    enabled: Boolean(address) && enabled,
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      fetchAssets({
        address,
        chainId,
        tokenType,
        pageParam: pageParam as string | null,
      }),
    getNextPageParam: (lastPage: AssetPage) => lastPage.pageKey,
    staleTime: tokenType === 'ERC-20' ? 2 * 60_000 : 10 * 60_000,
    retry: (failureCount, error) =>
      failureCount < 3 && !error.message.includes('404'),
  })

  const pages = query.data?.pages as AssetPage[] | undefined
  const assets = pages ? pages.flatMap(p => p.assets) : []
  const totalCount = assets.length

  const fetchNextPage = async (): Promise<void> => {
    if (query.hasNextPage) {
      await query.fetchNextPage()
    }
  }

  const refetch = async (): Promise<void> => {
    await query.refetch()
  }

  const prefetch = async (): Promise<void> => {
    await queryClient.prefetchInfiniteQuery<AssetPage, Error>({
      queryKey,
      initialPageParam: null,
      queryFn: ({ pageParam }) =>
        fetchAssets({
          address,
          chainId,
          tokenType,
          pageParam: pageParam as string | null,
        }),
      getNextPageParam: (lastPage: AssetPage) => lastPage.pageKey,
      staleTime: tokenType === 'ERC-20' ? 2 * 60_000 : 10 * 60_000,
    })
  }

  const clearCache = (): void => {
    queryClient.removeQueries({ queryKey })
  }

  return {
    assets,
    totalCount,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
    fetchNextPage,
    hasNextPage: Boolean(query.hasNextPage),
    isFetchingNextPage: query.isFetchingNextPage,
    refetch,
    prefetch,
    clearCache,
  }
}

/**
 * Delegates to ERC-20 or NFT Alchemy endpoints.
 */
async function fetchAssets({
  address,
  chainId,
  tokenType,
  pageParam,
}: {
  address: string
  chainId: number
  tokenType: TokenType
  pageParam: string | null
}): Promise<AssetPage> {
  if (!address) return { assets: [], pageKey: null }

  // RitoNet has no Alchemy indexer. Show only the Key NFT contract (ERC-721) via RPC.
  // For ERC-20 / ERC-1155, return empty (selectable, but no assets).
  if (chainId === CHAIN_IDS.ritonet) {
    if (tokenType === 'ERC-721') {
      return fetchRitonetKeyNftAssets(address)
    }
    return { assets: [], pageKey: null }
  }

  if (tokenType === 'ERC-20') {
    const rpc = ALCHEMY_RPC_URLS[chainId]
    if (!rpc) throw new Error(`ERC-20 not supported on chain ${chainId}`)
    const { assets } = await fetchERC20Assets(address, rpc)
    return { assets, pageKey: null }
  }

  const nftApi = ALCHEMY_NFT_API_URLS[chainId]
  if (!nftApi) throw new Error(`NFT not supported on chain ${chainId}`)
  return fetchNFTAssets(address, tokenType, pageParam, nftApi)
}

/**
 * Fetch ERC-20 balances + metadata via Alchemy RPC.
 */
async function fetchERC20Assets(
  address: string,
  alchemyRpc: string
): Promise<{ assets: ERC20Asset[] }> {
  const body = {
    jsonrpc: '2.0',
    method: 'alchemy_getTokenBalances',
    params: [address, 'DEFAULT_TOKENS'],
    id: 1,
  }
  const res = await fetch(alchemyRpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)

  const nonZero = (data.result.tokenBalances as unknown as TokenBalanceEntry[]).filter(
    t => t.tokenBalance && !/^0x0+$/.test(t.tokenBalance)
  )

  const assets: ERC20Asset[] = await Promise.all(
    nonZero.map<Promise<ERC20Asset>>(async (token: TokenBalanceEntry) => {
      const balance = token.tokenBalance ?? '0x0'
      try {
        const meta = await fetch(alchemyRpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'alchemy_getTokenMetadata',
            params: [token.contractAddress],
            id: 1,
          }),
        }).then(r => r.json())
        const md = (meta.result ?? {}) as TokenMetadata
        return {
          contractAddress: token.contractAddress,
          name: md.name || 'Unknown Token',
          symbol: md.symbol || 'UNKNOWN',
          decimals: typeof md.decimals === 'number' ? md.decimals : 18,
          balance,
          logo: md.logo,
        }
      } catch {
        return {
          contractAddress: token.contractAddress,
          name: 'Unknown Token',
          symbol: 'UNKNOWN',
          decimals: 18,
          balance,
        }
      }
    })
  )

  return { assets }
}

/**
 * Fetch paginated NFTs via Alchemy NFT API v3.
 */
async function fetchNFTAssets(
  address: string,
  tokenType: TokenType,
  pageParam: string | null,
  nftApiUrl: string
): Promise<AssetPage> {
  const params = new URLSearchParams({
    owner: address,
    pageSize: '100',
    withMetadata: 'true',
  })
  if (pageParam) params.append('pageKey', pageParam)

  const res = await fetch(`${nftApiUrl}/getNFTsForOwner?${params}`)
  if (!res.ok) throw new Error(`Alchemy NFT failed: ${res.status}`)
  const data = await res.json()
  const nfts: AlchemyOwnedNft[] = (data.ownedNfts ?? []) as unknown as AlchemyOwnedNft[]

  const filtered = nfts.filter(nft => {
    const nftTokenType = nft.contract?.tokenType;
    if (tokenType === 'ERC-721' && nftTokenType !== 'ERC721') return false;
    if (tokenType === 'ERC-1155' && nftTokenType !== 'ERC1155') return false;
    return true;
  })

  const assets: NFTAsset[] = filtered.map<NFTAsset>(nft => {
    // Match the original component's comprehensive image extraction
    const possibleImages = [
      nft.image?.cachedUrl,
      nft.image?.originalUrl,
      nft.image?.pngUrl,
      nft.image?.thumbnailUrl,
      nft.media?.[0]?.gateway,
      nft.media?.[0]?.thumbnail,
      nft.media?.[0]?.raw,
      nft.metadata?.image,
      nft.metadata?.image_url,
      nft.raw?.metadata?.image,
      nft.raw?.metadata?.image_url,
    ];

    let imageUrl = possibleImages.find(img => img) || undefined;
    if (imageUrl?.startsWith('ipfs://')) {
      imageUrl = `https://ipfs.io/ipfs/${imageUrl.slice(7)}`;
    }

    // Normalize balance to the expected string | undefined
    const balanceStr: string | undefined =
      nft.balance != null ? String(nft.balance) : undefined;

    return {
      tokenId: nft.tokenId || '0',
      contractAddress: nft.contract?.address ?? '',
      name: nft.name || nft.contract?.name || `Token #${nft.tokenId}`,
      description: nft.description || nft.raw?.metadata?.description,
      image: imageUrl,
      attributes: normalizeAttributes(nft.raw?.metadata?.attributes ?? nft.rawMetadata?.attributes ?? []),
      balance: balanceStr,
    }
  })

  return {
    assets,
    pageKey: data.pageKey ?? null,
  }
}
