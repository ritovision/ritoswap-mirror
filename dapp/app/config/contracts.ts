// app/config/contracts.ts
import { Address } from 'viem'
import localhostAddress from '@Contract/local_blockchain.json'
import mainnetAddress from '@Contract/mainnet.json'
import sepoliaAddress from '@Contract/sepolia.json'
import { getActiveChain, Chain } from '@config/chain'

// Pick the correct address based on active chain (from chain.ts)
export const KEY_TOKEN_ADDRESS = (() => {
  const active = getActiveChain()
  switch (active) {
    case Chain.RITONET:
      return localhostAddress.OnePerWalletKeyToken.address as Address
    case Chain.SEPOLIA:
      return sepoliaAddress.OnePerWalletKeyToken.address as Address
    case Chain.ETHEREUM:
    default:
      return mainnetAddress.OnePerWalletKeyToken.address as Address
  }
})()

export const onePerWalletAbi = [
  { 
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  },
  { 
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  { 
    type: 'function',
    name: 'getTokenOfOwner',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'hasToken', type: 'bool' }
    ]
  }
] as const

export const keyTokenAbi = [
  // --- Core & app-specific ---
  {
    type: 'function',
    name: 'burn',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: []
  },
  {
    type: 'function',
    name: 'tokensOfOwner',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }]
  },
  {
    type: 'function',
    name: 'getTokenColors',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'backgroundColor', type: 'string' },
      { name: 'keyColor', type: 'string' }
    ]
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },

  // --- Transfers ---
  {
    type: 'function',
    name: 'transferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'safeTransferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' }
    ],
    outputs: []
  },
  // (Optional overloaded safeTransferFrom with data omitted; add if you need it.)

  // --- Metadata ---
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }]
  },
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
  },

  // --- ERC721Enumerable additions (needed for holders enumeration) ---
  {
    type: 'function',
    name: 'tokenByIndex',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'tokenOfOwnerByIndex',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },

  // --- Events ---
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true }
    ]
  }
] as const

// Combined ABI for all operations
export const fullKeyTokenAbi = [...onePerWalletAbi, ...keyTokenAbi] as const
