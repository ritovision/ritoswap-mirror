// dapp/app/schemas/dto/mcp.ts
//
// Hand-rolled MCP wire contracts (Zod v4).
// These are the only shapes your server/client should use on the wire.
// Keep domain logic and SDKs out of here.

import { z } from 'zod';

/** Content items returned by tool calls (wire-level). */
export const ContentItemSchema = z.object({
  type: z.string(),                 // e.g., 'text', 'json', 'image', ...
  text: z.string().optional(),      // used for simple textual results
  data: z.unknown().optional(),     // arbitrary structured payloads
});
export type ContentItem = z.infer<typeof ContentItemSchema>;

/** Minimal wire shape for a tool in tools/list responses. */
export const ToolWireSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  // JSON-like schema. Avoid exporting Zod instances over the wire.
  inputSchema: z.record(z.string(), z.unknown()),
  // IMPORTANT: do not expose server-side gating flags on the wire
});
export type ToolWire = z.infer<typeof ToolWireSchema>;

/** tools/list success payload. */
export const ListToolsResultSchema = z.object({
  tools: z.array(ToolWireSchema),
});
export type ListToolsResult = z.infer<typeof ListToolsResultSchema>;

/** tools/call success payload. */
export const CallToolResultSchema = z.object({
  content: z.array(ContentItemSchema),
  isError: z.boolean().optional(),
});
export type CallToolResult = z.infer<typeof CallToolResultSchema>;

/** General "success" envelope (union of possible success shapes). */
export const MCPSuccessSchema = z.union([ListToolsResultSchema, CallToolResultSchema]);
export type MCPSuccess = z.infer<typeof MCPSuccessSchema>;

/** Error envelope (wire-level). */
export const MCPErrorSchema = z.object({
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.unknown().optional(),
  }),
});
export type MCPError = z.infer<typeof MCPErrorSchema>;

/** Discriminated union for incoming requests. */
export const MCPRequestSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('tools/list'), params: z.object({}).optional() }),
  z.object({
    method: z.literal('tools/call'),
    params: z.object({
      name: z.string(),
      arguments: z.record(z.string(), z.unknown()).optional(),
    }),
  }),
]);
export type MCPRequest = z.infer<typeof MCPRequestSchema>;
