// app/schemas/token-status.ts
/**
 * Token Status Types - Central export file
 * 
 * This file re-exports all token status related types and utilities
 * for convenient importing throughout the application.
 */

// Domain types and utilities
export type {
  TokenStatus,
  TokenQueryResult,
  TokenValidationResult
} from './domain/token-status.domain';

export {
  validateTokenId,
  formatTokenAddress,
  formatTokenUsageDate
} from './domain/token-status.domain';

// DTO schemas and types
export {
  TokenStatusParamsSchema,
  TokenStatusResponseSchema,
  InvalidTokenIdErrorSchema,
  createTokenStatusResponse,
  parseTokenIdParam
} from './dto/token-status.dto';

export type {
  TokenStatusParams,
  TokenStatusResponse,
  InvalidTokenIdError
} from './dto/token-status.dto';

// OpenAPI definitions (for documentation generation)
export {
  TokenIdParamSchema,
  TokenStatusResponseOpenAPISchema,
  TokenStatusExistsUsedResponseSchema,
  TokenStatusExistsUnusedResponseSchema,
  TokenStatusNotExistsResponseSchema,
  TokenStatusBadRequestResponseSchema,
  TokenStatusRateLimitResponseSchema,
  TokenStatusServerErrorResponseSchema,
  TokenStatusMethodNotAllowedSchema,
  TokenStatusRateLimitHeadersSchema,
  tokenStatusRouteDefinition
} from './openapi/token-status.openapi';