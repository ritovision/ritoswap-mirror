// app/schemas/domain/token-status.domain.ts
import { TokenIdStringSchema } from '@/app/config/security.public';

/**
 * Domain types for token status operations
 */

export interface TokenStatus {
  tokenId: number;
  exists: boolean;
  used: boolean;
  usedBy: string | null;
  usedAt: Date | null;
}

export interface TokenQueryResult extends Omit<TokenStatus, 'tokenId'> {
  count: number;
}

export interface TokenValidationResult {
  isValid: boolean;
  tokenId?: number;
  error?: string;
}

/**
 * Helper to validate token ID from string (uses shared schema)
 */
export function validateTokenId(tokenIdStr: string): TokenValidationResult {
  const parsed = TokenIdStringSchema.safeParse(tokenIdStr);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { isValid: false, error: issue?.message || 'Token ID must be numeric' };
  }
  const tokenId = parsed.data;
  if (tokenId > Number.MAX_SAFE_INTEGER) {
    return { isValid: false, error: 'Token ID exceeds maximum value' };
  }
  return { isValid: true, tokenId };
}

/**
 * Helper to format token address for display
 */
export function formatTokenAddress(address: string | null): string {
  if (!address) return 'N/A';
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Helper to format token usage date
 */
export function formatTokenUsageDate(date: Date | string | null): string | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString();
}
