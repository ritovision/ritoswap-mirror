/* dapp/app/lib/mcp/client.ts */

import { tool, type ToolSet } from 'ai';
import { createLogger } from '@logger';
import {
  CallToolResultSchema,
  ListToolsResultSchema,
  type CallToolResult,
  type ToolWire,
} from '@schemas/dto/mcp';

const logger = createLogger('mcp-client-hotfix');

export interface MCPClientConfig {
  endpoint: string;
  requiresJwt: boolean;
  jwt?: string | null;
  timeout?: number;
}

/** Safe stringify helper (best-effort) */
function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(
      obj,
      (_k: string, v: unknown) =>
        typeof v === 'function'
          ? `[Function:${(v as { name?: string }).name ?? 'anon'}]`
          : v,
      2,
    ) as string;
  } catch {
    return String(obj);
  }
}

/** Lightweight MCP HTTP client */
export class MCPClient {
  private config: MCPClientConfig;
  private requestId = 0;

  constructor(config: MCPClientConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  async callTool(toolName: string, args?: Record<string, unknown>): Promise<CallToolResult> {
    const rid = `mcp-${++this.requestId}`;
    logger.info('MCP tool call', { rid, toolName, hasArgs: Boolean(args) });

    const payload = {
      method: 'tools/call' as const,
      params: { name: toolName, arguments: args ?? {} },
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.requiresJwt && this.config.jwt) headers['Authorization'] = `Bearer ${this.config.jwt}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout!);

    try {
      const res = await fetch(this.config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!res.ok) {
        const t = await res.text().catch(() => 'unknown');
        throw new Error(`MCP call failed ${res.status}: ${t}`);
      }

      const json = (await res.json()) as unknown;
      logger.debug('MCP call response', { rid, preview: safeStringify(json)?.slice(0, 1200) });
      return CallToolResultSchema.parse(json);
    } catch (err) {
      logger.error('MCP call failed', { rid, error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }
}

/** Fetch available MCP tools from /api/mcp */
export async function fetchMCPTools(endpoint: string, jwt?: string | null): Promise<ToolWire[]> {
  const ctx = createLogger('mcp-tools-fetch');
  ctx.info('Fetching available MCP tools', { endpoint });
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ method: 'tools/list', params: {} }),
    });

    if (!res.ok) throw new Error(`Failed to fetch tools: ${res.status}`);
    const data = (await res.json()) as unknown;
    ctx.debug('fetchMCPTools raw response', { preview: safeStringify(data)?.slice(0, 2000) });
    const parsed = ListToolsResultSchema.parse(data);
    ctx.info('MCP tools fetched', { count: parsed.tools?.length ?? 0 });
    return parsed.tools || [];
  } catch (err) {
    ctx.error('Failed to fetch MCP tools', { error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

/**
 * Hotfix createMCPTools: register tools WITHOUT schemas (schema-less).
 * This avoids provider-utils -> OpenAI invalid_function_parameters error.
 */
export async function createMCPTools(config: MCPClientConfig): Promise<ToolSet> {
  const client = new MCPClient(config);
  const wireTools = await fetchMCPTools(config.endpoint, config.jwt);
  const tools: ToolSet = {};

  logger.info('createMCPTools (schema-less hotfix) start', { endpoint: config.endpoint, toolCount: wireTools.length });

  for (const w of wireTools) {
    logger.info('Registering schema-less tool', { name: w.name, description: w.description });
    logger.debug('Wire tool preview', { name: w.name, preview: safeStringify(w).slice(0, 1500) });

    const commonExecute = async (args?: Record<string, unknown>) => {
      logger.debug('tool.execute called', { tool: w.name, argsPreview: safeStringify(args)?.slice(0, 1000) });
      const res = await client.callTool(w.name, args);
      const pieces = res.content
        .map((c) => (c.type === 'text' && c.text != null ? c.text : JSON.stringify(c.data)))
        .filter((s): s is string => typeof s === 'string' && s.length > 0);
      const text = pieces.join('\n');
      logger.debug('tool.execute finished', { tool: w.name, resultPreview: String(text)?.slice(0, 1000) });
      return text || '';
    };

    try {
      // Intentionally do NOT include `parameters` or `inputSchema`.
      const def = {
        description: w.description ?? `MCP tool: ${w.name}`,
        execute: commonExecute,
      };

      logger.debug('Calling ai.tool() (schema-less) with def', { name: w.name, defPreview: safeStringify(def)?.slice(0, 1000) });

      tools[w.name] = tool(def as unknown as Parameters<typeof tool>[0]);
      logger.info('Tool registered (schema-less)', { name: w.name });
    } catch (err) {
      logger.error('Schema-less registration failed (unexpected)', { name: w.name, error: err instanceof Error ? err.message : String(err) });
      // continue with other tools; do not throw to avoid breaking tool loading
    }
  }

  logger.info('createMCPTools (schema-less) completed', { registeredCount: Object.keys(tools).length });
  logger.debug('Final tool keys', { keys: Object.keys(tools) });
  return tools;
}
