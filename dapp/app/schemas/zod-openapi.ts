// app/schemas/zod-openapi.ts
/**
 * Central Zod instance with OpenAPI extensions
 * Import this instead of 'zod' in all schema files
 */
import { z as zod } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// Extend Zod with OpenAPI capabilities once
extendZodWithOpenApi(zod);

// Export the extended z instance
export const z = zod;

// Re-export commonly used types
export type { infer as ZodInfer } from 'zod';