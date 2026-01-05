// app/lib/llm/tool-bridge.ts
import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createLogger } from '@logger';
import { toolRegistry } from '@lib/mcp/tools';
import { safeJson } from './utils';
import { readBearerFromRequest } from '@lib/jwt/server';
import type { ChatMode } from './modes/types';
import { getModeConfig } from './modes/configs';

const logger = createLogger('tool-bridge');

// Debug flag for verbose logging
const DEBUG_TOOLS = process.env.DEBUG_TOOLS === '1';

type JsonObject = Record<string, unknown>;

function isObject(v: unknown): v is JsonObject {
  return typeof v === 'object' && v !== null;
}

function isTextPart(x: unknown): x is { type: 'text'; text: string } {
  return isObject(x) && x.type === 'text' && typeof x.text === 'string';
}

function isJsonPart(x: unknown): x is { type: 'json'; data: unknown } {
  return isObject(x) && x.type === 'json' && 'data' in x;
}

/**
 * Get OpenAI-compatible tool schemas, optionally filtered by mode.
 *
 * @param mode - Optional ChatMode to filter tools by. If provided, only tools
 *               listed in the mode's mcpTools array will be returned.
 * @returns Array of OpenAI function tool schemas
 */
export function getOpenAIToolSchemas(mode?: ChatMode) {
  const allTools = toolRegistry.getAll();
  const names = allTools.map((t) => t.tool.name);

  logger.info('[registry]', {
    count: names.length,
    names,
    mode: mode || 'none',
  });

  // If no mode or mode is 'choose', return all tools
  if (!mode || mode === 'choose') {
    logger.info('[filter] No mode specified, returning all tools');
    return allTools.map((t) => {
      if (DEBUG_TOOLS) {
        logger.info('[schema]', {
          name: t.tool.name,
          schema: safeJson(t.tool.inputSchema),
        });
      }

      return {
        type: 'function' as const,
        function: {
          name: t.tool.name,
          description: t.tool.description,
          parameters: t.tool.inputSchema as Record<string, unknown>,
        },
      };
    });
  }

  // Get mode config and check for mcpTools whitelist
  const modeConfig = getModeConfig(mode);
  const mcpToolsWhitelist = modeConfig?.mcpTools;

  // If no mcpTools defined for this mode, allow all tools (backward compatible)
  if (!mcpToolsWhitelist || mcpToolsWhitelist.length === 0) {
    logger.info('[filter] No mcpTools whitelist for mode, allowing all tools', { mode });
    return allTools.map((t) => {
      if (DEBUG_TOOLS) {
        logger.info('[schema]', {
          name: t.tool.name,
          schema: safeJson(t.tool.inputSchema),
        });
      }

      return {
        type: 'function' as const,
        function: {
          name: t.tool.name,
          description: t.tool.description,
          parameters: t.tool.inputSchema as Record<string, unknown>,
        },
      };
    });
  }

  // Filter tools based on whitelist
  const whitelistSet = new Set(mcpToolsWhitelist);
  const filteredTools = allTools.filter((t) => whitelistSet.has(t.tool.name));

  logger.info('[filter] Applied mcpTools whitelist', {
    mode,
    whitelist: mcpToolsWhitelist,
    totalTools: allTools.length,
    filteredTools: filteredTools.length,
    allowedNames: filteredTools.map((t) => t.tool.name),
  });

  return filteredTools.map((t) => {
    if (DEBUG_TOOLS) {
      logger.info('[schema]', {
        name: t.tool.name,
        schema: safeJson(t.tool.inputSchema),
      });
    }

    return {
      type: 'function' as const,
      function: {
        name: t.tool.name,
        description: t.tool.description,
        parameters: t.tool.inputSchema as Record<string, unknown>,
      },
    };
  });
}

export async function callMcpTool(
  req: NextRequest,
  toolName: string,
  toolArgs: unknown,
  bearerOverride?: string, // explicit JWT to forward
): Promise<unknown> {
  const id = randomUUID();
  const url = new URL('/api/mcp', req.url);
  const payload = {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name: toolName, arguments: toolArgs },
  };

  // Determine bearer to forward: explicit override > incoming header
  const bearer =
    typeof bearerOverride === 'string' && bearerOverride.length > 0
      ? bearerOverride
      : readBearerFromRequest(req);

  logger.info('[mcp:request]', {
    url: url.toString(),
    toolName,
    args: DEBUG_TOOLS ? toolArgs : '[redacted]',
    hasBearer: Boolean(bearer),
  });

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (bearer) headers['authorization'] = `Bearer ${bearer}`;

  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const text = await resp.text();

  logger.info('[mcp:response:raw]', {
    status: resp.status,
    textLength: text.length,
    preview: text.slice(0, 200),
  });

  if (!resp.ok) {
    logger.error('[mcp:http:error]', { status: resp.status, text });
    throw new Error(`MCP HTTP ${resp.status}: ${text || 'unknown error'}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (e) {
    logger.error('[mcp:parse:error]', {
      error: String(e),
      text: text.slice(0, 300),
    });
    throw new Error(`MCP non-JSON response: ${text.slice(0, 300)}`);
  }

  // JSON-RPC error object?
  if (isObject(parsed) && 'error' in parsed && parsed.error) {
    const errObj = parsed.error as { code?: number; message?: string };
    logger.error('[mcp:rpc:error]', errObj);
    const code = typeof errObj.code === 'number' ? errObj.code : 'unknown';
    const msg = errObj.message || 'unknown';
    throw new Error(`MCP RPC error ${code}: ${msg}`);
  }

  // Handle both wrapped and unwrapped responses
  const result = isObject(parsed) && 'result' in parsed ? (parsed.result as unknown) : parsed;

  logger.info('[mcp:result]', {
    isError: isObject(result) && 'isError' in result ? Boolean((result as { isError?: unknown }).isError) : undefined,
    hasContent: isObject(result) && Array.isArray((result as { content?: unknown }).content),
    contentLength:
      isObject(result) && Array.isArray((result as { content?: unknown }).content)
        ? ((result as { content: unknown[] }).content.length)
        : undefined,
  });

  return result;
}

/**
 * IMPORTANT: When both text and JSON are present in tool output,
 * feed ONLY the text back to the model (concise summary),
 * and keep JSON for the UI via SSE.
 */
export function formatToolResult(result: unknown): string {
  // Prefer human-readable text parts for the model
  let content: unknown[] = [];
  if (isObject(result) && Array.isArray((result as { content?: unknown }).content)) {
    content = (result as { content: unknown[] }).content;
  }

  const texts = content.filter(isTextPart).map((c) => c.text.trim()).filter(Boolean);
  if (texts.length > 0) {
    return texts.join('\n');
  }

  // If only JSON (no text), synthesize a tiny one-liner instead of dumping JSON
  const jsonPart = content.find(isJsonPart);
  if (jsonPart) {
    try {
      const entries = Object.entries(jsonPart.data as Record<string, unknown>)
        .slice(0, 4)
        .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`);
      return entries.length ? `Result: ${entries.join(', ')}` : 'Result available.';
    } catch {
      // fallthrough
    }
  }

  // Last resort fallback
  return typeof result === 'string' ? result : safeJson(result, 300);
}
