// dapp/app/schemas/dto/rpc.ts
//
// JSON-RPC 2.0 wire contracts used by EVM RPC calls (Zod v4).
// Keep networking and timeouts in runtime code (utils), not here.

import { z } from 'zod';

export const RPCIdSchema = z.union([z.string(), z.number()]);

export const RPCRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  params: z.array(z.unknown()),
  id: RPCIdSchema,
});
export type RPCRequest = z.infer<typeof RPCRequestSchema>;

export const RPCErrorObjectSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().optional(),
});
export type RPCErrorObject = z.infer<typeof RPCErrorObjectSchema>;

export const RPCResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: RPCIdSchema,
  result: z.unknown().optional(),
  error: RPCErrorObjectSchema.optional(),
});
export type RPCResponse = z.infer<typeof RPCResponseSchema>;
