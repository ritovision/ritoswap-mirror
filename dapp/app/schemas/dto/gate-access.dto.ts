// app/schemas/dto/gate-access.dto.ts
import { z } from 'zod';
import { ErrorResponseSchema, ProblemDetailsSchema } from './common.dto';
import { NonceSchema, SignatureSchema } from '@/app/config/security.public';

/**
 * DTOs for /api/gate-access endpoint
 * Supports both SIWE and legacy authentication modes
 */

/**
 * Shared fields between SIWE and legacy requests
 */
const BaseGateAccessRequestSchema = z.object({
  /** Ethereum address */
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  /** Signature from wallet (65-byte ECDSA; centralized schema) */
  signature: SignatureSchema,
  /** Token ID (can be string or number from client) */
  tokenId: z.union([
    z.string().regex(/^\d+$/, 'Token ID must be numeric'),
    z.number().int().nonnegative(),
  ]),
});

/**
 * SIWE authentication request
 */
export const GateAccessSiweRequestSchema = BaseGateAccessRequestSchema.extend({
  /** Full SIWE message that was signed */
  message: z.string().min(1),
  /** Nonce from /api/nonce (centralized schema) */
  nonce: NonceSchema,
});
export type GateAccessSiweRequestDTO = z.infer<typeof GateAccessSiweRequestSchema>;

/**
 * Legacy (non-SIWE) authentication request
 */
export const GateAccessLegacyRequestSchema = BaseGateAccessRequestSchema.extend({
  /** Timestamp in milliseconds */
  timestamp: z.number().int().positive(),
});
export type GateAccessLegacyRequestDTO = z.infer<typeof GateAccessLegacyRequestSchema>;

/**
 * Union of both request types
 * The server determines which one based on field presence
 */
export const GateAccessRequestSchema = z.union([
  GateAccessSiweRequestSchema,
  GateAccessLegacyRequestSchema,
]);
export type GateAccessRequestDTO = z.infer<typeof GateAccessRequestSchema>;

/**
 * Audio data structure in gated content
 */
const AudioDataSchema = z.object({
  headline: z.string(),
  imageSrc: z.string(),
  imageAlt: z.string(),
  description: z.string(),
  title: z.string(),
  audioSrc: z.string(),
  /** Indicates if audio failed to load */
  error: z.boolean().optional(),
});

/**
 * Gated content structure
 */
const GatedContentSchema = z.object({
  /** Welcome message text */
  welcomeText: z.string(),
  /** HTML for the text submission area */
  textSubmissionAreaHtml: z.string(),
  /** Audio player data */
  audioData: AudioDataSchema,
  /** CSS styles to inject */
  styles: z.string(),
  /** JavaScript to execute */
  script: z.string(),
  /** Optional error flags */
  audioError: z.boolean().optional(),
  errorMessage: z.string().optional(),
});
export type GatedContent = z.infer<typeof GatedContentSchema>;

/**
 * Successful gate access response
 * Includes optional `accessToken` when a new JWT was minted (SIWE or legacy path).
 */
export const GateAccessSuccessResponseSchema = z.object({
  success: z.literal(true),
  access: z.literal('granted'),
  /** The gated content payload */
  content: GatedContentSchema,
  /** The freshly minted JWT access token (present when auth just occurred) */
  accessToken: z.string().optional(),
});
export type GateAccessSuccessResponseDTO = z.infer<typeof GateAccessSuccessResponseSchema>;

/**
 * Error responses from gate-access endpoint
 */
export const GateAccessErrorResponseSchema = z.union([
  ErrorResponseSchema,
  ProblemDetailsSchema,
]);
export type GateAccessErrorResponseDTO = z.infer<typeof GateAccessErrorResponseSchema>;

/**
 * Combined response type
 */
export type GateAccessResponseDTO =
  | GateAccessSuccessResponseDTO
  | GateAccessErrorResponseDTO;

/**
 * Type guards
 */
export function isGateAccessSuccess(data: unknown): data is GateAccessSuccessResponseDTO {
  return GateAccessSuccessResponseSchema.safeParse(data).success;
}

export function isGateAccessError(data: unknown): data is GateAccessErrorResponseDTO {
  return GateAccessErrorResponseSchema.safeParse(data).success;
}

/**
 * Helper to determine request type
 */
export function isGateAccessSiweRequest(data: unknown): data is GateAccessSiweRequestDTO {
  return GateAccessSiweRequestSchema.safeParse(data).success;
}

export function isGateAccessLegacyRequest(data: unknown): data is GateAccessLegacyRequestDTO {
  return GateAccessLegacyRequestSchema.safeParse(data).success;
}
