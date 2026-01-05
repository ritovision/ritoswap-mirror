// dapp/app/lib/mcp/tools/keynft-read/shared.ts
import { publicConfig, publicEnv } from '@config/public.env';
import { createLogger } from '@logger';
import {
  KEY_TOKEN_ADDRESS,
  fullKeyTokenAbi,
  onePerWalletAbi,
} from '@config/contracts';
import { callContract } from '../../utils/contracts';

export const logger = createLogger('keynft-read');

export const OWNER_REGEX = /^0x[a-fA-F0-9]{40}$/;
export const ZERO = '0x0000000000000000000000000000000000000000';

export function activeNetworkName(): string {
  switch (publicConfig.activeChain) {
    case 'ethereum':
      return 'Ethereum';
    case 'sepolia':
      return 'Sepolia';
    case 'ritonet':
      return publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME || 'RitoNet';
    default:
      return publicConfig.activeChain;
  }
}

export function shortAddr(addr: string): string {
  return OWNER_REGEX.test(addr) ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

export function fmtColor(v?: unknown): string | null {
  if (!v || typeof v !== 'string') return null;
  return v.startsWith('#') ? v : `#${v}`;
}

export function parseDec(x: number | string | undefined, fallback: bigint): bigint {
  if (x === undefined || x === null) return fallback;
  if (typeof x === 'number') return BigInt(x);
  if (typeof x === 'string' && /^\d+$/.test(x)) return BigInt(x);
  return fallback;
}

export {
  KEY_TOKEN_ADDRESS,
  fullKeyTokenAbi,
  onePerWalletAbi,
  callContract, // typed viem-based call
};
