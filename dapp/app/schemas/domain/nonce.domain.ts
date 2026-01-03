// app/schemas/domain/nonce.domain.ts

/**
 * Domain types for nonce operations (server-side only)
 * These types represent how the business logic thinks about nonces internally
 */

/**
 * Parameters for generating a new nonce
 */
export interface NonceGenerationParams {
  /** Unique identifier for the client (IP, fingerprint, etc.) */
  identifier: string;
  /** TTL in seconds (default: 300) */
  ttlSeconds?: number;
}

/**
 * Result of nonce generation
 */
export interface NonceGenerationResult {
  /** The generated nonce value */
  value: string;
  /** When the nonce expires */
  expiresAt: Date;
  /** The identifier it was generated for */
  identifier: string;
}

/**
 * Parameters for verifying a nonce
 */
export interface NonceVerificationParams {
  /** Client identifier */
  identifier: string;
  /** Nonce value to verify */
  nonce: string;
}

/**
 * Result of nonce verification
 */
export interface NonceVerificationResult {
  /** Whether the nonce is valid */
  isValid: boolean;
  /** If invalid, why */
  reason?: 'expired' | 'mismatch' | 'not_found';
}