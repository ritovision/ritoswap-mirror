// dapp/app/api/mcp/route.ts
import { createLogger } from '@logger';
import { mcpServer } from '@lib/mcp/server';
import { aiServerConfig } from '@config/ai.server';
import { verifyAccessToken, readJwtFromAny } from '@lib/jwt/server';

const logger = createLogger('mcp-api');

export const runtime = 'nodejs';
export const maxDuration = 300;

type JsonRecord = Record<string, unknown>;
function isJsonRecord(v: unknown): v is JsonRecord {
  return typeof v === 'object' && v !== null;
}
function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Handle MCP protocol requests
 * POST /api/mcp
 */
export async function POST(req: Request): Promise<Response> {
  try {
    // Parse request body (needed for JWT-in-body fallback)
    const body: unknown = await req.json().catch(() => {
      throw new Error('Invalid JSON body');
    });

    // Optional JWT gate (mirrors chat route policy)
    if (aiServerConfig.requiresJwt) {
      const bearer = readJwtFromAny(req, body);
      if (!bearer) {
        logger.warn('Unauthorized MCP call: missing JWT');
        return new Response(JSON.stringify({ error: 'Unauthorized: missing JWT' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      try {
        await verifyAccessToken(bearer);
      } catch (e: unknown) {
        logger.warn('Unauthorized MCP call: invalid JWT', { error: getErrorMessage(e) });
        return new Response(JSON.stringify({ error: 'Unauthorized: invalid JWT' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    
    logger.info('MCP API request', {
      method: isJsonRecord(body) ? (body as { method?: unknown }).method : undefined,
      hasParams: isJsonRecord(body) ? Boolean((body as { params?: unknown }).params) : false,
    });
    
    // Delegate to MCP server
    // Note: body was already read, pass along explicitly
    return await mcpServer.handleRequest(req, body);
    
  } catch (error: unknown) {
    logger.error('MCP API error', {
      error: getErrorMessage(error),
    });
    
    return new Response(
      JSON.stringify({
        error: {
          code: -32700,
          message: 'Parse error',
        },
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Handle unsupported methods
 */
export async function GET(): Promise<Response> {
  return new Response(
    JSON.stringify({
      error: 'MCP endpoint only supports POST requests',
      info: 'This is a Model Context Protocol (MCP) server endpoint',
    }),
    {
      status: 405,
      headers: { 
        'Content-Type': 'application/json',
        'Allow': 'POST',
      },
    }
  );
}
