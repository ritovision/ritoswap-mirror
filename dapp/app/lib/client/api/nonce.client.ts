// app/lib/client/api/nonce.client.ts
import { requestJSON, type ApiResult } from './_http';
import {
  NonceResponseSchema,
  NonceErrorResponseSchema,
  type NonceResponseDTO,
  type NonceErrorResponseDTO,
} from '@/app/schemas/dto/nonce.dto';
import { API_PATHS } from '../signing';

/** Fetches a SIWE nonce and validates the response. */
export async function fetchNonce(): Promise<ApiResult<NonceResponseDTO, NonceErrorResponseDTO>> {
  return requestJSON(
    API_PATHS.nonce,
    { method: 'GET' },
    NonceResponseSchema,
    NonceErrorResponseSchema
  );
}
