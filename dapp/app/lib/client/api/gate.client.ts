// app/lib/client/api/gate.client.ts
import { requestJSON, jsonHeaders, type ApiResult } from './_http';
import {
  GateAccessSuccessResponseSchema,
  GateAccessErrorResponseSchema,
  type GateAccessSiweRequestDTO,
  type GateAccessLegacyRequestDTO,
  type GateAccessSuccessResponseDTO,
  type GateAccessErrorResponseDTO,
} from '@/app/schemas/dto/gate-access.dto';
import { API_PATHS } from '../signing';

export type GateUnlockRequest = GateAccessSiweRequestDTO | GateAccessLegacyRequestDTO;

/**
 * Request access to the gate (SIWE or Legacy).
 * Validates the response using the DTO schemas.
 */
export async function requestGateAccess(
  payload: GateUnlockRequest,
  init?: Omit<RequestInit, 'method' | 'body' | 'headers'>
): Promise<ApiResult<GateAccessSuccessResponseDTO, GateAccessErrorResponseDTO>> {
  return requestJSON(
    API_PATHS.gateAccess,
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
      ...init,
    },
    GateAccessSuccessResponseSchema,
    GateAccessErrorResponseSchema
  );
}
