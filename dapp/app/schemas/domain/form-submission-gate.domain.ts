// app/schemas/domain/form-submission-gate.domain.ts

/**
 * Domain types for form submission gate operations
 */

/**
 * Form submission data
 */
export interface FormSubmissionData {
  tokenId: string;
  message: string;
  address: string;
  timestamp: number;
}

/**
 * Email notification result
 */
export interface EmailNotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Token ownership verification result
 */
export interface TokenOwnershipResult {
  isOwner: boolean;
  ownedTokenId?: bigint;
  hasToken: boolean;
}

/**
 * Form submission validation result
 */
export interface FormSubmissionValidationResult {
  isValid: boolean;
  tokenIdNum?: number;
  tokenIdBigInt?: bigint;
  error?: string;
  errorCode?: 'MISSING_FIELD' | 'INVALID_TYPE' | 'MESSAGE_TOO_LONG' | 'INVALID_TOKEN_FORMAT' | 'TOKEN_OUT_OF_RANGE';
}

/**
 * Helper to validate form submission data
 */
export function validateFormSubmission(data: unknown): FormSubmissionValidationResult {
  const d = data as {
    tokenId?: unknown;
    message?: unknown;
    address?: unknown;
    timestamp?: unknown;
    signature?: unknown;
  };

  // Check required fields
  if (d.tokenId === undefined || d.tokenId === null) {
    return { isValid: false, error: 'Missing tokenId', errorCode: 'MISSING_FIELD' };
  }
  if (typeof d.message !== 'string') {
    return { isValid: false, error: 'Missing or invalid message', errorCode: 'INVALID_TYPE' };
  }
  if (!d.signature || typeof d.signature !== 'string') {
    return { isValid: false, error: 'Missing signature', errorCode: 'MISSING_FIELD' };
  }
  if (!d.address || typeof d.address !== 'string') {
    return { isValid: false, error: 'Missing address', errorCode: 'MISSING_FIELD' };
  }
  if (typeof d.timestamp !== 'number') {
    return { isValid: false, error: 'Missing or invalid timestamp', errorCode: 'INVALID_TYPE' };
  }
  if (d.message.length > 10000) {
    return { isValid: false, error: 'Message too long', errorCode: 'MESSAGE_TOO_LONG' };
  }

  // Validate tokenId format
  const tokenIdStr = String(d.tokenId);
  let tokenIdBigInt: bigint;
  try {
    tokenIdBigInt = BigInt(tokenIdStr);
  } catch {
    return { isValid: false, error: 'Invalid tokenId format', errorCode: 'INVALID_TOKEN_FORMAT' };
  }

  if (tokenIdBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
    return { isValid: false, error: 'Invalid tokenId range', errorCode: 'TOKEN_OUT_OF_RANGE' };
  }

  const tokenIdNum = Number(tokenIdStr);

  return {
    isValid: true,
    tokenIdNum,
    tokenIdBigInt
  };
}

/**
 * Helper to format address for display
 */
export function formatAddress(addr?: string): string {
  if (!addr || !addr.startsWith('0x') || addr.length <= 10) {
    return addr || '';
  }
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
