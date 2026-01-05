// dapp/app/lib/mcp/server/dispatcher.ts
import { createLogger } from '@logger';
import {
  MCPRequestSchema,
  type ListToolsResult,
  type CallToolResult,
  type MCPSuccess,
  type MCPError,
} from '@schemas/dto/mcp';
import { toolRegistry } from '../tools';
import { verifyMCPAuth } from './auth';
import type { ToolDefinition } from '../tools/types';
import type { AuthClaims } from './auth';

const logger = createLogger('mcp-dispatcher');

export class MCPDispatcher {
  private requestId = 0;

  async dispatch(req: Request, request: unknown): Promise<MCPSuccess | MCPError> {
    const rid = `mcp-dispatch-${++this.requestId}`;

    try {
      const validatedRequest = MCPRequestSchema.parse(request);

      logger.info('Dispatching MCP request', { rid, method: validatedRequest.method });

      switch (validatedRequest.method) {
        case 'tools/list':
          return await this.handleListTools(rid);

        case 'tools/call':
          return await this.handleCallTool(
            rid,
            req,
            validatedRequest,
            validatedRequest.params.name,
            validatedRequest.params.arguments,
          );

        default: {
          const _exhaustive: never = validatedRequest;
          throw new Error(
            `Unknown method: ${String((validatedRequest as { method?: unknown }).method)}`,
          );
        }
      }
    } catch (error) {
      logger.error('Request dispatch failed', {
        rid,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      };
    }
  }

  private async handleListTools(_rid: string): Promise<ListToolsResult> {
    const tools = toolRegistry.getAll();
    return { tools: tools.map(({ tool }) => tool) };
  }

  private async handleCallTool(
    rid: string,
    req: Request,
    rawBody: unknown,
    toolName: string,
    args?: Record<string, unknown>,
  ): Promise<CallToolResult> {
    try {
      const toolDef = toolRegistry.get(toolName) as ToolDefinition | undefined;
      if (!toolDef) throw new Error(`Tool not found: ${toolName}`);

      const requiresJwt = Boolean(toolDef.requiresJwt);

      let mergedArgs: Record<string, unknown> = { ...(args || {}) };

      if (requiresJwt) {
        // Single source of truth: verify + obtain claims so we can inject into args.
        const authResult = await verifyMCPAuth(req, rawBody, { force: true });
        if (!authResult.authenticated) {
          logger.warn('Per-tool authentication failed', { rid, toolName });
          return {
            content: [{ type: 'text', text: authResult.error ?? 'Authentication required' }],
            isError: true,
          };
        }

        const claims = authResult.claims as AuthClaims | undefined;

        const jwtAddressRaw =
          (claims?.address && typeof claims.address === 'string' && claims.address.length > 0
            ? claims.address
            : claims?.addr && typeof claims.addr === 'string' && claims.addr.length > 0
            ? claims.addr
            : claims?.sub && typeof claims.sub === 'string' && claims.sub.length > 0
            ? claims.sub
            : undefined);

        if (typeof jwtAddressRaw === 'string' && jwtAddressRaw.length > 0) {
          mergedArgs = {
            ...mergedArgs,
            __jwt: {
              address: jwtAddressRaw,
              sub: claims?.sub,
              tokenId: authResult.tokenId,
            },
          };
          logger.debug('Injected __jwt into tool args', {
            rid,
            toolName,
            hasAddress: true,
          });
        } else {
          logger.warn('JWT verified but no address/sub found to inject', { rid, toolName });
        }
      }

      logger.info('Calling tool', { rid, toolName, hasArgs: Object.keys(mergedArgs).length > 0 });

      const result = await toolDef.handler(mergedArgs);

      logger.info('Tool execution complete', {
        rid,
        toolName,
        isError: result.isError,
        contentCount: result.content.length,
      });

      return result;
    } catch (error) {
      logger.error('Tool execution failed', {
        rid,
        toolName,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        content: [
          { type: 'text', text: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}` },
        ],
        isError: true,
      };
    }
  }
}
