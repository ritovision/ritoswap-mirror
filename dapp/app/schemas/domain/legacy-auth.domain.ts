// app/schemas/domain/legacy-auth.domain.ts

/**
 * Domain types for legacy (non-SIWE) authentication
 */

/**
 * Parameters for building a legacy message
 */
export interface LegacyMessageParams {
  tokenId: string;
  reqHost: string | null;
  path: string;
  method: string;
  chainId: number;
  timestamp: number;
}

/**
 * Parameters for legacy authentication verification
 */
export interface LegacyAuthVerificationParams {
  request: Request | { headers: Headers; method: string; url: string };
  address: `0x${string}`;
  signature: `0x${string}`;
  tokenId: string;
  timestamp: number;
  requireAllowlist?: boolean;
  maxSkewMs?: number;
  futureLeewayMs?: number;
}

/**
 * Result of legacy authentication
 */
export type LegacyAuthResult =
  | {
      success: true;
      reqHost: string;
      chainId: number;
      expectedMessage: string;
    }
  | {
      success: false;
      status: number;
      code: 'INVALID_TIMESTAMP' | 'FUTURE_TIMESTAMP' | 'EXPIRED' | 'ALLOWLIST_REQUIRED' | 'HOST_NOT_ALLOWED' | 'CHAIN_CONFIG' | 'INVALID_SIGNATURE';
      message: string;
    };