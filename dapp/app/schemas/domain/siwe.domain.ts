// app/schemas/domain/siwe.domain.ts

/**
 * Domain types for SIWE operations (server-side only)
 * These types represent internal SIWE verification logic
 */

/**
 * Parsed SIWE message fields that we care about internally
 */
export interface ParsedSiweMessage {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
  notBefore?: string;
}

/**
 * Parameters for SIWE message verification
 */
export interface SiweVerificationParams {
  /** Raw SIWE message string */
  message: string;
  /** Signature from the wallet */
  signature: `0x${string}`;
  /** Expected nonce */
  nonce: string;
  /** Expected address */
  address: `0x${string}`;
  /** Request headers for domain validation */
  requestHeaders?: Headers;
}

/**
 * Result of SIWE verification
 */
export interface SiweVerificationResult {
  success: boolean;
  error?: 'invalid_format' | 'domain_mismatch' | 'address_mismatch' | 'nonce_mismatch' | 'expired' | 'invalid_signature' | 'verification_failed';
  /** Parsed message if successful */
  parsed?: ParsedSiweMessage;
}

/**
 * Parameters for creating a SIWE message (used by client helpers)
 */
export interface SiweMessageCreationParams {
  address: string;
  nonce: string;
  statement?: string;
  domain?: string;
  uri?: string;
  chainId?: number;
}