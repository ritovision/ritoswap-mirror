// app/utils/assetFetcher.ts
import { createPublicClient, http, type Chain } from 'viem';
import { mainnet, polygon, arbitrum, avalanche, base, optimism, fantom, sepolia } from 'wagmi/chains';
import { NFTAsset, ERC20Asset } from '@/app/portfolio/components/assets/AssetDisplay';
import { publicEnv } from '@config/public.env';

export interface FetchAssetsParams {
  address: string;
  chainId: number;
  tokenType: 'ERC-20' | 'ERC-721' | 'ERC-1155';
  pageKey: string | null;
}

export interface FetchAssetsResult {
  assets: (NFTAsset | ERC20Asset)[];
  pageKey: string | null;
}

// Narrow types used for external API shapes
type MinimalChain = { id: number; rpcUrls: { default: { http: string[] } } };

interface ChainConfigEntry {
  chain: MinimalChain;
  alchemyUrl: string;
  nftUrl: string;
}

type TokenBalance = {
  contractAddress: string;
  tokenBalance: string;
};

type AlchemyNFTV3 = {
  tokenId?: string;
  contract?: { address?: string; tokenType?: string; name?: string };
  name?: string;
  description?: string;
  image?: { pngUrl?: string; originalUrl?: string };
  media?: Array<{ gateway?: string }>;
  raw?: { metadata?: { image?: string; description?: string; attributes?: unknown[] } };
  metadata?: { image?: string };
  balance?: string;
};

// Get the Alchemy API key from validated public env
const ALCHEMY_API_KEY = publicEnv.NEXT_PUBLIC_ALCHEMY_API_KEY ?? "";

// Get RitoNet Network info and RPC from validated public env
export const RITONET_CHAIN_ID = Number(publicEnv.NEXT_PUBLIC_LOCAL_CHAIN_ID) || 90999999;
export const RITONET_RPC = publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_RPC ?? "";
export const RITONET_NAME = publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME ?? "RitoNet";
export const RITONET_NETWORK = RITONET_NAME.toLowerCase().replace(/\s+/g, "");

// Simple IPFS URL converter
function convertIPFSUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${url.slice(7)}`;
  }
  return url;
}

// Map chain IDs to chains and Alchemy/NFT endpoints
export const CHAIN_CONFIG: Record<number, ChainConfigEntry> = {
  1: {
    chain: mainnet as unknown as MinimalChain,
    alchemyUrl: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    nftUrl: `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`,
  },
  137: {
    chain: polygon as unknown as MinimalChain,
    alchemyUrl: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    nftUrl: `https://polygon-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`,
  },
  42161: {
    chain: arbitrum as unknown as MinimalChain,
    alchemyUrl: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    nftUrl: `https://arb-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`,
  },
  43114: {
    chain: avalanche as unknown as MinimalChain,
    alchemyUrl: `https://avax-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    nftUrl: `https://avax-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, // Avalanche might not support v3
  },
  8453: {
    chain: base as unknown as MinimalChain,
    alchemyUrl: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    nftUrl: `https://base-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`,
  },
  10: {
    chain: optimism as unknown as MinimalChain,
    alchemyUrl: `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    nftUrl: `https://opt-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`,
  },
  250: {
    chain: fantom as unknown as MinimalChain,
    alchemyUrl: `https://fantom-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    nftUrl: `https://fantom-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, // Fantom might not support v3
  },
  11155111: {
    chain: sepolia as unknown as MinimalChain,
    alchemyUrl: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    nftUrl: `https://eth-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`,
  },
  // RitoNet – use environment-configured RPC & chain ID/name/network
  [RITONET_CHAIN_ID]: {
    chain: {
      id: RITONET_CHAIN_ID,
      name: RITONET_NAME,
      network: RITONET_NETWORK,
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [RITONET_RPC] } },
    } as MinimalChain,
    alchemyUrl: RITONET_RPC,
    nftUrl: RITONET_RPC,
  },
};

export async function fetchAssets(params: FetchAssetsParams): Promise<FetchAssetsResult> {
  const { address, chainId, tokenType, pageKey } = params;

  const config = CHAIN_CONFIG[chainId];
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  if (chainId === RITONET_CHAIN_ID) {
    return fetchAssetsViaRPC(params, config);
  }

  if (tokenType === 'ERC-20') {
    return fetchERC20AssetsAlchemy(address, config.alchemyUrl);
  } else {
    return fetchNFTAssetsAlchemy(address, tokenType, pageKey, config.nftUrl);
  }
}

// Fetch using Alchemy's enhanced APIs
async function fetchERC20AssetsAlchemy(
  address: string,
  alchemyUrl: string
): Promise<FetchAssetsResult> {
  try {
    const response = await fetch(alchemyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'alchemy_getTokenBalances',
        params: [address, 'DEFAULT_TOKENS'],
        id: 1,
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const balances = (data.result.tokenBalances || []) as TokenBalance[];

    const assets: ERC20Asset[] = await Promise.all(
      balances
        .filter((token: TokenBalance) => token.tokenBalance !== '0x0')
        .map(async (token: TokenBalance) => {
          try {
            const metadataResponse = await fetch(alchemyUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'alchemy_getTokenMetadata',
                params: [token.contractAddress],
                id: 1,
              }),
            });

            const metadataData = await metadataResponse.json();
            const metadata = metadataData.result || {};

            return {
              contractAddress: token.contractAddress,
              name: metadata.name || 'Unknown Token',
              symbol: metadata.symbol || 'UNKNOWN',
              decimals: metadata.decimals || 18,
              balance: token.tokenBalance,
              logo: metadata.logo || undefined,
            };
          } catch (error) {
            console.error(`Error fetching metadata for ${token.contractAddress}:`, error);
            return {
              contractAddress: token.contractAddress,
              name: 'Unknown Token',
              symbol: 'UNKNOWN',
              decimals: 18,
              balance: token.tokenBalance,
            };
          }
        })
    );

    return { assets, pageKey: null };
  } catch (error) {
    console.error('Error fetching ERC-20 assets:', error);
    return { assets: [], pageKey: null };
  }
}

// UPDATED TO USE V3 API!
async function fetchNFTAssetsAlchemy(
  address: string,
  tokenType: 'ERC-721' | 'ERC-1155',
  pageKey: string | null,
  nftApiUrl: string
): Promise<FetchAssetsResult> {
  try {
    const params = new URLSearchParams({
      owner: address,
      pageSize: '100',
      withMetadata: 'true',
    });

    if (pageKey) {
      params.append('pageKey', pageKey);
    }

    const response = await fetch(`${nftApiUrl}/getNFTsForOwner?${params}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const nfts = (data.ownedNfts || []) as AlchemyNFTV3[];

    const assets: NFTAsset[] = nfts
      .filter((nft: AlchemyNFTV3) => {
        const nftTokenType = nft.contract?.tokenType;
        if (tokenType === 'ERC-721' && nftTokenType !== 'ERC721') return false;
        if (tokenType === 'ERC-1155' && nftTokenType !== 'ERC1155') return false;
        if (!nft.contract?.address) return false;
        return true;
      })
      .map((nft: AlchemyNFTV3) => {
        let imageUrl =
          nft.image?.pngUrl ||
          nft.image?.originalUrl ||
          nft.media?.[0]?.gateway ||
          nft.raw?.metadata?.image ||
          nft.metadata?.image;

        imageUrl = convertIPFSUrl(imageUrl);

        const rawAttrs = nft.raw?.metadata?.attributes;
        const attributes =
          Array.isArray(rawAttrs)
            ? ((rawAttrs as unknown) as NFTAsset['attributes'])
            : ([] as NFTAsset['attributes']);

        return {
          tokenId: nft.tokenId || '0',
          contractAddress: nft.contract!.address as string,
          name: nft.name || nft.contract?.name || `Token #${nft.tokenId}`,
          description: nft.description || nft.raw?.metadata?.description,
          image: imageUrl,
          attributes,
          balance: nft.balance || undefined,
        };
      });

    return { assets, pageKey: data.pageKey || null };
  } catch (error) {
    console.error('Error fetching NFT assets:', error);
    return { assets: [], pageKey: null };
  }
}

// Basic RPC fallback for custom chains like RitoNet
async function fetchAssetsViaRPC(
  params: FetchAssetsParams,
  config: ChainConfigEntry
): Promise<FetchAssetsResult> {
  const { tokenType } = params;

  const _publicClient = createPublicClient({
    chain: (config.chain as unknown) as Chain,
    transport: http(config.alchemyUrl),
  });

  if (tokenType === 'ERC-20') {
    console.log('ERC-20 token fetching for custom chains not fully implemented');
    return { assets: [], pageKey: null };
  } else {
    console.log('NFT fetching for custom chains not fully implemented');
    return { assets: [], pageKey: null };
  }
}
