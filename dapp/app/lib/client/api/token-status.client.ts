// app/lib/client/api/token-status.client.ts
import { requestJSON, type ApiResult } from './_http';
import {
  TokenStatusResponseSchema,
  InvalidTokenIdErrorSchema,
  type TokenStatusResponse,
} from '@/app/schemas/dto/token-status.dto';
import { ErrorResponseSchema, ProblemDetailsSchema } from '@/app/schemas/dto/common.dto';
import { API_PATHS } from '../signing';
import { z } from 'zod';

/** Combined error schema: invalid id OR generic error/problem details. */
const TokenStatusErrorSchema = z.union([InvalidTokenIdErrorSchema, ErrorResponseSchema, ProblemDetailsSchema]);

export async function fetchTokenStatus(
  tokenId: number | string
): Promise<ApiResult<TokenStatusResponse, z.infer<typeof TokenStatusErrorSchema>>> {
  return requestJSON(
    API_PATHS.tokenStatus(tokenId),
    { method: 'GET' },
    TokenStatusResponseSchema,
    TokenStatusErrorSchema
  );
}
