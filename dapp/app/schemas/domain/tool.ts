// dapp/app/schemas/domain/tool.ts
//
// Domain-level tool abstraction (JSON Schema).
// Handlers receive raw args (validated by their own logic) and return wire-level CallToolResult.
// Keep this SDK-free and framework-agnostic.

import type { CallToolResult } from '../../schemas/dto/mcp';

export interface Tool<TParams = unknown> {
  /** Internal and wire-exposed tool name (snake_case recommended). */
  name: string;
  /** Short human description. */
  description: string;
  /** JSON Schema object describing the input shape to expose to models. */
  inputSchema: Record<string, unknown>;
  /** When true, this tool requires a valid JWT even if global auth is disabled. */
  requiresJwt?: boolean;
  /** Business logic. Must return a wire-level CallToolResult. */
  handler: (params: TParams) => Promise<CallToolResult>;
}
