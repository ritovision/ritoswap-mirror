// app/lib/client/api/form-submission.client.ts
import { requestJSON, jsonHeaders, type ApiResult } from './_http';
import {
  FormSubmissionRequestSchema,
  FormSubmissionSuccessResponseSchema,
  FormSubmissionErrorResponseSchema,
  type FormSubmissionRequestDTO,
  type FormSubmissionSuccessResponseDTO,
  type FormSubmissionErrorResponseDTO,
} from '@/app/schemas/dto/form-submission-gate.dto';
import { API_PATHS } from '../signing';

/**
 * Submit the gated form payload (legacy signing flow).
 * You can pre-validate the request with FormSubmissionRequestSchema.parse(payload) if desired.
 */
export async function submitForm(
  payload: FormSubmissionRequestDTO,
  init?: Omit<RequestInit, 'method' | 'body' | 'headers'>
): Promise<ApiResult<FormSubmissionSuccessResponseDTO, FormSubmissionErrorResponseDTO>> {
  // Optional strict client-side request validation:
  const pre = FormSubmissionRequestSchema.safeParse(payload);
  if (!pre.success) {
    const err: FormSubmissionErrorResponseDTO = {
      error: pre.error.issues[0]?.message ?? 'Invalid request body',
    };
    return {
      ok: false,
      status: 400,
      error: err,
      headers: new Headers(),
    };
  }

  return requestJSON(
    API_PATHS.formSubmissionGate,
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(pre.data),
      ...init,
    },
    FormSubmissionSuccessResponseSchema,
    FormSubmissionErrorResponseSchema
  );
}
