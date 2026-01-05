/// <reference types="vitest" />

import { renderHook, act } from '@testing-library/react-hooks'
import { waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAssets } from '../useAssets'
import type { ERC20Asset, NFTAsset } from '../../components/assets/AssetDisplay'
import { KEY_TOKEN_ADDRESS } from '@config/contracts'

vi.mock('@config/public.env', () => ({
  __esModule: true,
  publicEnv: {
    NEXT_PUBLIC_ALCHEMY_API_KEY: '',
    NEXT_PUBLIC_ACTIVE_CHAIN: 'ritonet',
    NEXT_PUBLIC_LOCAL_CHAIN_ID: 90999999,
    NEXT_PUBLIC_LOCAL_BLOCKCHAIN_RPC: 'https://localhost:8545',
  },
}))

const readContractMock = vi.fn()
vi.mock('viem', () => ({
  __esModule: true,
  createPublicClient: () => ({
    readContract: (args: any) => readContractMock(args),
  }),
  http: (url: string) => ({ url }),
}))

describe('useAssets (Vitest)', () => {
  let queryClient: QueryClient
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          retryDelay: 0,
          staleTime: Infinity,
        },
      },
    })
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  // ─── ERC-20 branch ──────────────────────────────────────────────────────────────
  describe('ERC-20 branch', () => {
    it('fetches ERC-20 assets and exposes them', async () => {
      const dummyTokenBalance = { contractAddress: '0xToken', tokenBalance: '0x10' }
      const dummyMetadata = {
        result: { name: 'DUMMY', symbol: 'DUM', decimals: 4, logo: 'https://logo' },
      }

      fetchMock
        .mockResolvedValueOnce({ json: async () => ({ result: { tokenBalances: [dummyTokenBalance] } }) })
        .mockResolvedValueOnce({ json: async () => dummyMetadata })

      const { result, waitForNextUpdate } = renderHook(
        () => useAssets({ address: '0xAbC123', chainId: 1, tokenType: 'ERC-20' }),
        { wrapper },
      )

      expect(result.current.isLoading).toBe(true)
      await waitForNextUpdate()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result.current.assets).toEqual<ERC20Asset[]>([
        {
          contractAddress: '0xToken',
          name: 'DUMMY',
          symbol: 'DUM',
          decimals: 4,
          balance: '0x10',
          logo: 'https://logo',
        },
      ])
      expect(result.current.totalCount).toBe(1)
      expect(result.current.hasNextPage).toBe(false)
      expect(result.current.isFetchingNextPage).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('does not fetch when address is empty or enabled=false', () => {
      const { result: r1 } = renderHook(
        () => useAssets({ address: '', chainId: 1, tokenType: 'ERC-20' }),
        { wrapper },
      )
      expect(r1.current.isLoading).toBe(false)
      expect(fetchMock).not.toHaveBeenCalled()

      const { result: r2 } = renderHook(
        () => useAssets({ address: '0xFoo', chainId: 1, tokenType: 'ERC-20', enabled: false }),
        { wrapper },
      )
      expect(r2.current.isLoading).toBe(false)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('clearCache evicts the query', async () => {
      fetchMock.mockResolvedValue({ json: async () => ({ result: { tokenBalances: [] } }) })

      const { result, waitForNextUpdate } = renderHook(
        () => useAssets({ address: '0xBar', chainId: 1, tokenType: 'ERC-20' }),
        { wrapper },
      )
      await waitForNextUpdate()

      expect(queryClient.getQueryState(['assets', '0xbar', 1, 'ERC-20'])).toBeDefined()
      act(() => result.current.clearCache())
      expect(queryClient.getQueryState(['assets', '0xbar', 1, 'ERC-20'])).toBeUndefined()
    })

    it('fetchNextPage on ERC-20 is a no-op (no pagination)', async () => {
      fetchMock.mockResolvedValueOnce({ json: async () => ({ result: { tokenBalances: [] } }) })

      const { result, waitForNextUpdate } = renderHook(
        () => useAssets({ address: '0xNoPage', chainId: 1, tokenType: 'ERC-20' }),
        { wrapper },
      )
      await waitForNextUpdate()

      expect(result.current.hasNextPage).toBe(false)
      await act(async () => {
        await result.current.fetchNextPage()
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('falls back on metadata-fetch errors', async () => {
      const dummyTokenBalance = { contractAddress: '0xFail', tokenBalance: '0x0A' }

      fetchMock
        .mockResolvedValueOnce({ json: async () => ({ result: { tokenBalances: [dummyTokenBalance] } }) })
        .mockRejectedValueOnce(new Error('Network failure'))

      const { result, waitForNextUpdate } = renderHook(
        () => useAssets({ address: '0xAbC123', chainId: 1, tokenType: 'ERC-20' }),
        { wrapper },
      )
      await waitForNextUpdate()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result.current.assets).toEqual<ERC20Asset[]>([
        {
          contractAddress: '0xFail',
          name: 'Unknown Token',
          symbol: 'UNKNOWN',
          decimals: 18,
          balance: '0x0A',
        },
      ])
      expect((result.current.assets[0] as any).price).toBeUndefined()
    })

    it('retries on transient token-balance errors up to 3 times', async () => {
      const serverErr = { error: { message: 'Server Error' } }
      fetchMock
        .mockResolvedValueOnce({ json: async () => serverErr })
        .mockResolvedValueOnce({ json: async () => serverErr })
        .mockResolvedValueOnce({ json: async () => serverErr })
        .mockResolvedValueOnce({ json: async () => ({ result: { tokenBalances: [] } }) })

      const { result } = renderHook(
        () => useAssets({ address: '0xRetry', chainId: 1, tokenType: 'ERC-20' }),
        { wrapper },
      )

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(fetchMock).toHaveBeenCalledTimes(4)
      expect(result.current.error).toBeNull()
      expect(result.current.assets).toEqual([])
    })
  })

  // ─── NFT branch ────────────────────────────────────────────────────────────────
  describe('NFT branch', () => {
    it('fetches ERC-721 NFTs and maps image + metadata correctly', async () => {
      const dummyApiResponse = {
        ownedNfts: [
          {
            contract: { address: '0xNFTAddr', tokenType: 'ERC721', name: 'CoolNFT' },
            tokenId: '42',
            metadata: { image: 'ipfs://QmSomeHash' },
            raw: {
              metadata: {
                description: 'The best NFT',
                attributes: [{ trait_type: 'Cool', value: 'Very' }],
              },
            },
            balance: '1',
          },
          { contract: { address: '0xOther', tokenType: 'ERC1155' }, tokenId: '99' },
        ],
        pageKey: null,
      }

      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => dummyApiResponse })

      const { result, waitForNextUpdate } = renderHook(
        () => useAssets({ address: '0xAbC123', chainId: 1, tokenType: 'ERC-721' }),
        { wrapper },
      )
      await waitForNextUpdate()

      const assets = result.current.assets as NFTAsset[]
      expect(assets).toHaveLength(1)
      expect(assets[0]).toEqual<NFTAsset>({
        tokenId: '42',
        contractAddress: '0xNFTAddr',
        name: 'CoolNFT',
        description: 'The best NFT',
        image: 'https://ipfs.io/ipfs/QmSomeHash',
        attributes: [{ trait_type: 'Cool', value: 'Very' }],
        balance: '1',
      })
      expect(result.current.hasNextPage).toBe(false)
    })

    it('fetches ERC-1155 NFTs when tokenType="ERC-1155"', async () => {
      const dummyMulti = {
        ownedNfts: [
          {
            contract: { address: '0xMAddr', tokenType: 'ERC1155', name: 'Multi' },
            tokenId: '7',
            media: [{ gateway: 'https://cdn.example.com/7.png' }],
            raw: { metadata: {} },
            metadata: {},
            balance: '3',
          },
        ],
        pageKey: null,
      }

      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => dummyMulti })

      const { result, waitForNextUpdate } = renderHook(
        () => useAssets({ address: '0xAbC123', chainId: 1, tokenType: 'ERC-1155' }),
        { wrapper },
      )
      await waitForNextUpdate()

      const assets = result.current.assets as NFTAsset[]
      expect(assets).toEqual([
        {
          tokenId: '7',
          contractAddress: '0xMAddr',
          name: 'Multi',
          description: undefined,
          image: 'https://cdn.example.com/7.png',
          attributes: [],
          balance: '3',
        },
      ])
      expect(result.current.hasNextPage).toBe(false)
    })

    it('falls back across full image-fallback list', async () => {
      const dummyApiResponse = {
        ownedNfts: [
          {
            contract: { address: '0xImg', tokenType: 'ERC721' },
            tokenId: '99',
            image: {
              originalUrl: 'https://original',
              pngUrl: 'https://png',
              thumbnailUrl: 'https://thumb',
            },
            media: [
              { gateway: 'https://med-gw', thumbnail: 'https://med-th', raw: 'https://med-raw' },
            ],
            metadata: { image_url: 'https://meta-url' },
            raw: { metadata: { image_url: 'https://raw-meta-url' } },
            balance: '1',
          },
        ],
        pageKey: null,
      }

      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => dummyApiResponse })

      const { result, waitForNextUpdate } = renderHook(
        () => useAssets({ address: '0xImgOwner', chainId: 1, tokenType: 'ERC-721' }),
        { wrapper },
      )
      await waitForNextUpdate()

      const assets = result.current.assets as NFTAsset[]
      expect(assets[0].image).toBe('https://original')
    })
  })

  // ─── Additional behaviors ────────────────────────────────────────────────────────
  describe('Additional behaviors', () => {
    it('paginates multiple NFT pages correctly', async () => {
      const firstPage = {
        ownedNfts: [
          {
            contract: { address: '0x1', tokenType: 'ERC721' },
            tokenId: '1',
            metadata: { image: 'https://img1' },
            raw: { metadata: { attributes: [] } },
            balance: '1',
          },
        ],
        pageKey: 'next',
      }
      const secondPage = {
        ownedNfts: [
          {
            contract: { address: '0x2', tokenType: 'ERC721' },
            tokenId: '2',
            metadata: { image: 'https://img2' },
            raw: { metadata: { attributes: [] } },
            balance: '1',
          },
        ],
        pageKey: null,
      }

      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => firstPage })
        .mockResolvedValueOnce({ ok: true, json: async () => secondPage })

      const { result, waitForNextUpdate } = renderHook(
        () => useAssets({ address: '0xabc', chainId: 1, tokenType: 'ERC-721' }),
        { wrapper },
      )

      await waitForNextUpdate()
      let assets = result.current.assets as NFTAsset[]
      expect(assets.map(a => a.tokenId)).toEqual(['1'])
      expect(result.current.hasNextPage).toBe(true)

      await act(async () => {
        await result.current.fetchNextPage()
      })
      await waitFor(() => {
        assets = result.current.assets as NFTAsset[]
        expect(assets.map(a => a.tokenId)).toEqual(['1', '2'])
        expect(result.current.hasNextPage).toBe(false)
      })
    })

    it('does not retry on 404 errors for NFTs', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 404 })

      const { result, waitForNextUpdate } = renderHook(
        () => useAssets({ address: '0xabc', chainId: 1, tokenType: 'ERC-721' }),
        { wrapper },
      )
      await waitForNextUpdate()

      expect(result.current.isError).toBe(true)
      expect(result.current.error?.message).toBe('Alchemy NFT failed: 404')
    })

    it('supports prefetch()', async () => {
      const spy = vi
        .spyOn(queryClient, 'prefetchInfiniteQuery')
        .mockResolvedValueOnce({ pages: [], pageParams: [] } as any)

      const { result } = renderHook(
        () => useAssets({ address: '0xabc', chainId: 1, tokenType: 'ERC-20' }),
        { wrapper },
      )

      await act(async () => {
        await result.current.prefetch()
      })

      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })

    it('handles unsupported chain errors', async () => {
      const { result } = renderHook(
        () => useAssets({ address: '0xabc', chainId: 250, tokenType: 'ERC-721' }),
        { wrapper },
      )

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
        expect(result.current.error?.message).toBe('NFT not supported on chain 250')
      })
    })

    it('deduplicates concurrent ERC-20 queries', async () => {
      // prepare dummy responses but delay them
      const dummyTokenBalance = { contractAddress: '0xToken', tokenBalance: '0x10' }
      const dummyMetadata = { result: { name: 'DUP', symbol: 'DUP', decimals: 8 } }

      let resolveBalance!: () => void
      let resolveMetadata!: () => void

      const balancePromise = new Promise<void>(r => { resolveBalance = r })
      const metadataPromise = new Promise<void>(r => { resolveMetadata = r })

      fetchMock
        .mockImplementationOnce(() =>
          balancePromise.then(() => ({
            json: async () => ({ result: { tokenBalances: [dummyTokenBalance] } }),
          }))
        )
        .mockImplementationOnce(() =>
          metadataPromise.then(() => ({
            json: async () => dummyMetadata,
          }))
        )

      // mount two hooks concurrently
      const hook1 = renderHook(
        () => useAssets({ address: '0xDup', chainId: 1, tokenType: 'ERC-20' }),
        { wrapper },
      )
      const hook2 = renderHook(
        () => useAssets({ address: '0xDup', chainId: 1, tokenType: 'ERC-20' }),
        { wrapper },
      )

      // only the balances call has fired so far
      expect(fetchMock).toHaveBeenCalledTimes(1)

      // resolve balances → should kick off metadata once
      act(() => resolveBalance())
      await act(async () => Promise.resolve())
      expect(fetchMock).toHaveBeenCalledTimes(2)

      // resolve metadata
      act(() => resolveMetadata())

      // wait for both hooks to update
      await Promise.all([hook1.waitForNextUpdate(), hook2.waitForNextUpdate()])

      // both hooks see the same data and no extra fetches occurred
      expect(hook1.result.current.assets).toEqual([
        {
          contractAddress: '0xToken',
          name: 'DUP',
          symbol: 'DUP',
          decimals: 8,
          balance: '0x10',
        },
      ])
      expect(hook2.result.current.assets).toEqual(hook1.result.current.assets)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('RitoNet branch', () => {
    const RITONET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_LOCAL_CHAIN_ID || 90999999)

    beforeEach(() => {
      readContractMock.mockReset()
    })

    it('returns empty for ERC-20 on RitoNet (no fetch, no error)', async () => {
      const { result, waitForNextUpdate } = renderHook(
        () => useAssets({ address: '0xabc', chainId: RITONET_CHAIN_ID, tokenType: 'ERC-20' }),
        { wrapper },
      )

      await waitForNextUpdate()

      expect(fetchMock).not.toHaveBeenCalled()
      expect(result.current.error).toBeNull()
      expect(result.current.assets).toEqual([])
    })

    it('returns empty for ERC-1155 on RitoNet (no fetch, no error)', async () => {
      const { result, waitForNextUpdate } = renderHook(
        () => useAssets({ address: '0xabc', chainId: RITONET_CHAIN_ID, tokenType: 'ERC-1155' }),
        { wrapper },
      )

      await waitForNextUpdate()

      expect(fetchMock).not.toHaveBeenCalled()
      expect(result.current.error).toBeNull()
      expect(result.current.assets).toEqual([])
    })

    it('fetches ERC-721 via RPC on RitoNet and decodes data: tokenURI metadata', async () => {
      const meta = {
        name: 'Colored Key #42',
        description: 'On-chain',
        image: 'data:image/svg+xml;base64,PHN2Zy8+',
        attributes: [{ trait_type: 'Background Color', value: '#fff' }],
      }
      const tokenUri = `data:application/json;base64,${Buffer.from(JSON.stringify(meta), 'utf8').toString('base64')}`

      readContractMock.mockImplementation(async ({ functionName }: { functionName: string }) => {
        if (functionName === 'tokensOfOwner') return [42n]
        if (functionName === 'tokenURI') return tokenUri
        throw new Error(`Unexpected functionName: ${functionName}`)
      })

      const { result, waitForNextUpdate } = renderHook(
        () => useAssets({ address: '0xabc', chainId: RITONET_CHAIN_ID, tokenType: 'ERC-721' }),
        { wrapper },
      )

      await waitForNextUpdate()

      expect(fetchMock).not.toHaveBeenCalled()
      expect(result.current.error).toBeNull()
      expect(result.current.assets).toEqual([
        {
          tokenId: '42',
          contractAddress: KEY_TOKEN_ADDRESS,
          name: 'Colored Key #42',
          description: 'On-chain',
          image: 'data:image/svg+xml;base64,PHN2Zy8+',
          attributes: [{ trait_type: 'Background Color', value: '#fff' }],
          balance: '1',
        },
      ])
    })
  })
})
