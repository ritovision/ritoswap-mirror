/* dapp/app/lib/mcp/types.ts */
import { z } from 'zod';

/**
 * Request schema for MCP-like tools.
 */
export const MCPRequestSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('tools/list'),
    params: z.object({}).optional(),
  }),
  z.object({
    method: z.literal('tools/call'),
    params: z.object({
      name: z.string(),
      arguments: z.record(z.string(), z.unknown()).optional(),
    }),
  }),
]);

export type MCPRequest = z.infer<typeof MCPRequestSchema>;

/**
 * Error response schema.
 */
export const MCPErrorSchema = z.object({
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.unknown().optional(),
  }),
});

/**
 * Success response schema — can be either tool listing or tool call result.
 */
export const MCPSuccessSchema = z.union([
  z.object({
    tools: z.array(z.object({
      name: z.string(),
      description: z.string().optional(),
      inputSchema: z.record(z.string(), z.unknown()),
    })),
  }),
  z.object({
    content: z.array(z.object({
      type: z.string(),
      text: z.string().optional(),
      data: z.unknown().optional(),
    })),
    isError: z.boolean().optional(),
  }),
]);

export type MCPResponse =
  | z.infer<typeof MCPSuccessSchema>
  | z.infer<typeof MCPErrorSchema>;

/**
 * Minimal redefinitions of MCP types (so we don’t import @modelcontextprotocol/sdk).
 */

export interface CallToolRequest {
  method: 'tools/call';
  params: {
    name: string;
    arguments?: Record<string, unknown>;
  };
}

export interface CallToolResult {
  content: Array<{
    type: string;
    text?: string;
    data?: unknown;
  }>;
  isError?: boolean;
}

export interface ListToolsResult {
  tools: Array<{
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
  }>;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

/**
 * Tool registry definition.
 */
export interface ToolDefinition {
  tool: MCPTool;
  handler: (args: Record<string, unknown>) => Promise<CallToolResult>;
}

/**
 * Server configuration for MCP-like servers.
 */
export interface MCPServerConfig {
  requiresJwt: boolean;
  tools: Map<string, ToolDefinition>;
}
