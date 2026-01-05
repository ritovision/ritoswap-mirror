/* dapp/app/lib/mcp/tools/types.ts */
import type { Tool as DomainTool } from '@schemas/domain/tool';
import type { ToolWire, CallToolResult } from '@schemas/dto/mcp';

/** Runtime entry stored in the registry. */
export type ToolDefinition = {
  /** Wire-exposed manifest (shown in tools/list). */
  tool: ToolWire;
  /** Handler to execute. */
  handler: (args: Record<string, unknown>) => Promise<CallToolResult>;
  /** Server-only gating flag (do NOT expose on wire). */
  requiresJwt?: boolean;
};

/** Lift a domain Tool into a registry ToolDefinition. */
export function createTool<TParams = unknown>(t: DomainTool<TParams>): ToolDefinition {
  const manifest: ToolWire = {
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    // do not include requiresJwt here; keep it server-side only
  };

  return {
    tool: manifest,
    handler: (args: Record<string, unknown>) => t.handler(args as TParams),
    requiresJwt: Boolean(t.requiresJwt),
  };
}

/** Helpers to shape wire results from handlers. */
export function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: 'json', data }] };
}
export function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
}
export function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}
