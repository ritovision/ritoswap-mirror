// app/schemas/dto/form-submission-gate.dto.ts
import { z } from 'zod';
import { ErrorResponseSchema, ProblemDetailsSchema, SuccessResponseSchema } from './common.dto';
import { SignatureSchema } from '@/app/config/security.public';

/**
 * DTOs for /api/form-submission-gate endpoint
 */

/**
 * Request body schema
 */
export const FormSubmissionRequestSchema = z.object({
  tokenId: z.union([z.string(), z.number()]).transform(val => String(val)),
  message: z.string().max(10000, 'Message too long'),
  /** Wallet signature (65-byte ECDSA; centralized schema) */
  signature: SignatureSchema,
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  timestamp: z.number().int().positive()
});
export type FormSubmissionRequestDTO = z.infer<typeof FormSubmissionRequestSchema>;

/**
 * Successful submission response
 */
export const FormSubmissionSuccessResponseSchema = SuccessResponseSchema.extend({
  message: z.literal('Access granted')
});
export type FormSubmissionSuccessResponseDTO = z.infer<typeof FormSubmissionSuccessResponseSchema>;

/**
 * Form submission error responses
 */
export const FormSubmissionErrorResponseSchema = z.union([
  ErrorResponseSchema,
  ProblemDetailsSchema
]);
export type FormSubmissionErrorResponseDTO = z.infer<typeof FormSubmissionErrorResponseSchema>;

/**
 * Helper to parse and validate request body
 */
export function parseFormSubmissionRequest(body: unknown): {
  success: true;
  data: FormSubmissionRequestDTO;
} | {
  success: false;
  error: string;
  field?: string;
} {
  const result = FormSubmissionRequestSchema.safeParse(body);
  
  if (!result.success) {
    const firstError = result.error.issues[0];
    return {
      success: false,
      error: firstError?.message || 'Invalid request body',
      field: firstError?.path[0] as string | undefined
    };
  }
  
  return {
    success: true,
    data: result.data
  };
}

/**
 * Helper to create success response
 */
export function createFormSubmissionSuccess(): FormSubmissionSuccessResponseDTO {
  return FormSubmissionSuccessResponseSchema.parse({
    success: true,
    message: 'Access granted'
  });
}
