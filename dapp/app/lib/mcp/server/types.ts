// dapp/app/lib/mcp/server/types.ts
import type { ToolDefinition } from '../tools/types';

export interface MCPServerConfig {
  requiresJwt: boolean;
  tools: Map<string, ToolDefinition>;
}
