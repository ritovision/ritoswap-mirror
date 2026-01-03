// app/utils/__tests__/assetFetcher.test.ts

// ——————————————————————————————————————————
// Stub out the viem client so we never actually hit an RPC
// ——————————————————————————————————————————
vi.mock('viem', () => ({
  createPublicClient: vi.fn(),
  http:               vi.fn(),
  parseAbi:           vi.fn(),
  formatUnits:        vi.fn(),
}))

import {
  CHAIN_CONFIG,
  fetchAssets,
  RITONET_CHAIN_ID,
  RITONET_RPC,
} from '@/app/utils/assetFetcher'

// a single global fetch mock
const fetchMock = vi.fn()

// spies for console.log / console.error
let logSpy: ReturnType<typeof vi.spyOn>
let errorSpy: ReturnType<typeof vi.spyOn>

beforeAll(() => {
  // capture console calls
  logSpy   = vi.spyOn(console, 'log').mockImplementation(() => {})
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterAll(() => {
  logSpy.mockRestore()
  errorSpy.mockRestore()
})

beforeEach(() => {
  fetchMock.mockReset()
  // @ts-ignore
  global.fetch = fetchMock
  logSpy.mockClear()
  errorSpy.mockClear()
})

describe('assetFetcher', () => {
  describe('CHAIN_CONFIG', () => {
    it('has mainnet URLs that include the Alchemy key', () => {
      const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? ''
      const mainnet = CHAIN_CONFIG[1]
      expect(mainnet.alchemyUrl).toBe(
        `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`
      )
      expect(mainnet.nftUrl).toBe(
        `https://eth-mainnet.g.alchemy.com/nft/v3/${apiKey}`
      )
    })

    it('includes a RitoNet entry driven by env vars', () => {
      const rito = CHAIN_CONFIG[RITONET_CHAIN_ID]
      expect(rito.chain.id).toBe(RITONET_CHAIN_ID)

      // RPC & NFT & alchemyUrl should all equal RITONET_RPC
      expect(rito.chain.rpcUrls.default.http[0]).toBe(RITONET_RPC)
      expect(rito.alchemyUrl).toBe(RITONET_RPC)
      expect(rito.nftUrl).toBe(RITONET_RPC)
    })
  })

  describe('fetchAssets()', () => {
    const address = '0xABC'
    const pageKey = null

    it('rejects unsupported chains', async () => {
      await expect(
        fetchAssets({
          address,
          chainId: 9999,
          tokenType: 'ERC-20',
          pageKey,
        })
      ).rejects.toThrow('Unsupported chain ID: 9999')
    })

    it('falls back to RPC for RitoNet (NFT)', async () => {
      const result = await fetchAssets({
        address,
        chainId: RITONET_CHAIN_ID,
        tokenType: 'ERC-721',
        pageKey,
      })

      // verify RPC‐fallback log
      expect(logSpy).toHaveBeenCalledWith(
        'NFT fetching for custom chains not fully implemented'
      )
      expect(result).toEqual({ assets: [], pageKey: null })
    })

    it('falls back to RPC for RitoNet (ERC-20)', async () => {
      const result = await fetchAssets({
        address,
        chainId: RITONET_CHAIN_ID,
        tokenType: 'ERC-20',
        pageKey,
      })

      // verify ERC20 RPC‐fallback log
      expect(logSpy).toHaveBeenCalledWith(
        'ERC-20 token fetching for custom chains not fully implemented'
      )
      expect(result).toEqual({ assets: [], pageKey: null })
    })

    it('fetches ERC-20 balances + metadata via Alchemy', async () => {
      const balancesPayload = {
        result: {
          tokenBalances: [
            { contractAddress: '0xT0', tokenBalance: '0x0' },
            { contractAddress: '0xT1', tokenBalance: '0x10' },
          ],
        },
      }
      const metadataPayload = {
        result: {
          name:     'Token1',
          symbol:   'T1',
          decimals: 8,
          logo:     'https://logo/1.png',
        },
      }

      fetchMock
        .mockResolvedValueOnce({ json: async () => balancesPayload })
        .mockResolvedValueOnce({ json: async () => metadataPayload })

      const { assets, pageKey: outKey } = await fetchAssets({
        address,
        chainId: 1,
        tokenType: 'ERC-20',
        pageKey,
      })

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(assets).toHaveLength(1)
      expect(assets[0]).toMatchObject({
        contractAddress: '0xT1',
        name:            'Token1',
        symbol:          'T1',
        decimals:        8,
        balance:         '0x10',
        logo:            'https://logo/1.png',
      })
      expect(outKey).toBeNull()
    })

    it('returns empty list on ERC-20 RPC error', async () => {
      fetchMock.mockRejectedValue(new Error('RPC fail'))

      const res = await fetchAssets({
        address,
        chainId: 1,
        tokenType: 'ERC-20',
        pageKey,
      })

      // verify error catch logging
      expect(errorSpy).toHaveBeenCalledWith(
        'Error fetching ERC-20 assets:',
        expect.objectContaining({ message: 'RPC fail' })
      )
      expect(res).toEqual({ assets: [], pageKey: null })
    })

    it('fetches ERC-721 NFTs via Alchemy NFT API', async () => {
      const nftResponse = {
        ownedNfts: [
          {
            contract:    { address: '0xN1', tokenType: 'ERC721' },
            tokenId:     '42',
            image:       { pngUrl: 'ipfs://QmHash' },
            name:        'My NFT',
            description: 'Cool on-chain art',
            raw:         { metadata: { attributes: [{ trait: 'cool' }] } },
            balance:     '1',
          },
        ],
        pageKey: 'NEXT_PAGE',
      }

      fetchMock.mockResolvedValueOnce({
        ok:   true,
        json: async () => nftResponse,
      })

      const { assets, pageKey: outKey } = await fetchAssets({
        address,
        chainId: 1,
        tokenType: 'ERC-721',
        pageKey: null,
      })

      expect(assets).toHaveLength(1)
      expect(assets[0]).toMatchObject({
        tokenId:         '42',
        contractAddress: '0xN1',
        name:            'My NFT',
        description:     'Cool on-chain art',
        image:           'https://ipfs.io/ipfs/QmHash',
        attributes:      [{ trait: 'cool' }],
        balance:         '1',
      })
      expect(outKey).toBe('NEXT_PAGE')
    })

    it('returns empty on NFT HTTP errors', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })

      const res = await fetchAssets({
        address,
        chainId: 1,
        tokenType: 'ERC-1155',
        pageKey: 'PG',
      })

      // verify NFT error‐catch logging
      expect(errorSpy).toHaveBeenCalledWith(
        'Error fetching NFT assets:',
        expect.objectContaining({ message: 'HTTP error! status: 500' })
      )
      expect(res).toEqual({ assets: [], pageKey: null })
    })
  })
})
