/* dapp/app/lib/mcp/server/index.ts */
import { createLogger } from '@logger';
import { MCPDispatcher } from './dispatcher';
import { verifyMCPAuth } from './auth';
import type { MCPServerConfig } from './types';
import { aiPublicConfig } from '@config/ai.public';
import { toolRegistry } from '../tools';

const logger = createLogger('mcp-server');

type ToolsCallBody = { method?: unknown; params?: { name?: unknown } };
function isToolsCall(body: unknown): body is { method: 'tools/call'; params: { name: unknown } } {
  if (!body || typeof body !== 'object') return false;
  const b = body as ToolsCallBody;
  return b.method === 'tools/call' && b.params !== undefined && b.params !== null && 'name' in b.params!;
}

export class MCPServer {
  private dispatcher: MCPDispatcher;
  private config: MCPServerConfig;

  constructor(config?: Partial<MCPServerConfig>) {
    this.config = {
      requiresJwt: config?.requiresJwt ?? aiPublicConfig.requiresJwt,
      tools: config?.tools ?? new Map(),
    };

    this.dispatcher = new MCPDispatcher();

    logger.info('MCP server initialized', {
      requiresJwt: this.config.requiresJwt,
    });
  }

  async handleRequest(req: Request, body: unknown): Promise<Response> {
    const rid = `mcp-req-${Date.now()}`;

    try {
      logger.info('MCP request received', { rid });

      // Global JWT gate (existing behavior). Per-tool gates are enforced below and in dispatcher.
      if (this.config.requiresJwt) {
        const authResult = await verifyMCPAuth(req, body);
        if (!authResult.authenticated) {
          logger.warn('MCP authentication failed', { rid, error: authResult.error });
          return new Response(
            JSON.stringify({ error: { code: -32001, message: authResult.error || 'Authentication required' } }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
          );
        }
      }

      // EARLY per-tool gate (server precheck) — uses server-only flag, not wire manifest.
      if (isToolsCall(body)) {
        const toolDef = toolRegistry.get(String(body.params.name));
        const requiresJwt = Boolean(toolDef?.requiresJwt);
        if (requiresJwt) {
          const authResult = await verifyMCPAuth(req, body, { force: true });
          if (!authResult.authenticated) {
            logger.warn('Per-tool authentication failed (server precheck)', {
              rid,
              toolName: String(body.params.name),
            });
            return new Response(
              JSON.stringify({ error: { code: -32001, message: authResult.error || 'Authentication required' } }),
              { status: 401, headers: { 'Content-Type': 'application/json' } },
            );
          }
        }
      }

      const response = await this.dispatcher.dispatch(req, body);

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logger.error('MCP request failed', {
        rid,
        error: error instanceof Error ? error.message : String(error),
      });

      return new Response(
        JSON.stringify({ error: { code: -32603, message: 'Internal server error' } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }
}

export const mcpServer = new MCPServer();
