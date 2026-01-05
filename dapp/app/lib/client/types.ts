// app/lib/client/types.ts
/**
 * Client-facing barrel: re-export common DTO types + small client-only helpers.
 * Keep this lightweight and client-safe (no server-only domain imports).
 */

import { ErrorResponseSchema, RateLimitInfoSchema } from '@schemas/dto/common.dto';
import type { z } from 'zod';

export type {
  // Gate access
  GatedContent,
  GateAccessSiweRequestDTO,
  GateAccessLegacyRequestDTO,
  GateAccessSuccessResponseDTO,
  GateAccessErrorResponseDTO,
} from '@/app/schemas/dto/gate-access.dto';

export type {
  // Form submission
  FormSubmissionRequestDTO,
  FormSubmissionSuccessResponseDTO,
  FormSubmissionErrorResponseDTO,
} from '@/app/schemas/dto/form-submission-gate.dto';

export type {
  // Nonce
  NonceResponseDTO,
  NonceErrorResponseDTO,
} from '@/app/schemas/dto/nonce.dto';

export type {
  // Token status (optional)
  TokenStatusResponse,
  InvalidTokenIdError,
} from '@/app/schemas/dto/token-status.dto';

/** Rate limit info (from response bodies or headers) */
export type RateLimitInfo = z.infer<typeof RateLimitInfoSchema>;

/** Narrow helper: does this look like an ErrorResponse (string error field)? */
export function isErrorResponse(x: unknown): x is z.infer<typeof ErrorResponseSchema> {
  if (!x || typeof x !== 'object') return false;
  const e = (x as { error?: unknown }).error;
  return typeof e === 'string';
}

/** Narrow helper: does the payload include rate-limit hints? */
export function hasRateLimitInfo(x: unknown): x is z.infer<typeof RateLimitInfoSchema> {
  const p = RateLimitInfoSchema.safeParse(x);
  return p.success;
}

/** Client auth mode helper (keep the source of truth centralized here). */
export type AuthMode = 'siwe' | 'legacy';
export function getAuthMode(): AuthMode {
  const { publicEnv } = require('@config/public.env'); // runtime import to avoid cycles
  return publicEnv.NEXT_PUBLIC_ENABLE_STATE_WORKER ? 'siwe' : 'legacy';
}
