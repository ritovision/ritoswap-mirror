// dapp/app/lib/llm/__tests__/tool-bridge.test.ts
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import type { Mock } from 'vitest';

// --- Mocks (via vi.mock namespace) ---
vi.mock('@logger', () => {
  const noop = vi.fn();
  return {
    createLogger: () => ({ info: noop, warn: noop, error: noop, debug: noop }),
  };
});

vi.mock('@lib/mcp/tools', () => ({
  toolRegistry: { getAll: vi.fn() },
}));

vi.mock('../modes/configs', () => ({
  getModeConfig: vi.fn(),
}));

vi.mock('@lib/jwt/server', () => ({
  readBearerFromRequest: vi.fn(),
}));

import { toolRegistry } from '@lib/mcp/tools';
import { getModeConfig } from '../modes/configs';
import { readBearerFromRequest } from '@lib/jwt/server';
import { getOpenAIToolSchemas, callMcpTool, formatToolResult } from '../tool-bridge';

// Local typed handles to mocked fns
const getAllMock = vi.mocked(toolRegistry.getAll);
const getModeConfigMock = vi.mocked(getModeConfig);
const readBearerMock = vi.mocked(readBearerFromRequest);

// Helpers
function makeTools(names: string[]) {
  return names.map((n) => ({
    tool: {
      name: n,
      description: `${n} desc`,
      inputSchema: { type: 'object', properties: { x: { type: 'string' } } },
    },
  }));
}

function makeReq(url = 'https://example.com/chat'): Request {
  return new Request(url, { headers: new Headers() });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  getAllMock.mockReset();
  getModeConfigMock.mockReset();
  readBearerMock.mockReset();
  delete (process as unknown as { env: Record<string, string | undefined> }).env.DEBUG_TOOLS;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getOpenAIToolSchemas', () => {
  it('returns all tools when no mode is provided', () => {
    getAllMock.mockReturnValueOnce(makeTools(['a', 'b']) as unknown as ReturnType<typeof getAllMock>);
    const schemas = getOpenAIToolSchemas();
    expect(schemas.map((s) => s.function.name)).toEqual(['a', 'b']);
    expect(schemas.every((s) => s.type === 'function')).toBe(true);
    expect(schemas[0].function).toMatchObject({
      description: 'a desc',
      parameters: { type: 'object', properties: { x: { type: 'string' } } },
    });
  });

  it('returns all tools when mode === "choose"', () => {
    getAllMock.mockReturnValueOnce(makeTools(['a', 'b', 'c']) as unknown as ReturnType<typeof getAllMock>);
    const schemas = getOpenAIToolSchemas('choose' as any);
    expect(schemas.map((s) => s.function.name)).toEqual(['a', 'b', 'c']);
  });

  it('returns all tools when mode has no whitelist (back-compat)', () => {
    getAllMock.mockReturnValueOnce(makeTools(['a', 'b']) as unknown as ReturnType<typeof getAllMock>);
    getModeConfigMock.mockReturnValueOnce({} as unknown as ReturnType<typeof getModeConfigMock>);
    const schemas = getOpenAIToolSchemas('any-mode' as any);
    expect(schemas.map((s) => s.function.name)).toEqual(['a', 'b']);
  });

  it('filters by whitelist when provided in mode config', () => {
    getAllMock.mockReturnValueOnce(makeTools(['a', 'b', 'c']) as unknown as ReturnType<typeof getAllMock>);
    getModeConfigMock.mockReturnValueOnce({ mcpTools: ['b'] } as unknown as ReturnType<typeof getModeConfigMock>);
    const schemas = getOpenAIToolSchemas('restricted' as any);
    expect(schemas.map((s) => s.function.name)).toEqual(['b']);
  });

  it('does not blow up when DEBUG_TOOLS=1 (extra logging path)', () => {
    (process as unknown as { env: Record<string, string | undefined> }).env.DEBUG_TOOLS = '1';
    getAllMock.mockReturnValueOnce(makeTools(['a']) as unknown as ReturnType<typeof getAllMock>);
    const schemas = getOpenAIToolSchemas();
    expect(schemas).toHaveLength(1);
  });
});

describe('callMcpTool', () => {
  it('prefers bearerOverride over header-derived bearer', async () => {
    const req = makeReq('https://site/some');
    readBearerMock.mockReturnValueOnce('fromHeader' as unknown as ReturnType<typeof readBearerMock>);

    (fetch as unknown as Mock).mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { content: [{ type: 'text', text: 'ok' }] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const out = await callMcpTool(req as any, 't', { a: 1 }, 'fromOverride');

    expect(fetch).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = (fetch as unknown as Mock).mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe('https://site/api/mcp');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['authorization']).toBe('Bearer fromOverride');

    const sent = JSON.parse(init.body as string);
    expect(sent).toMatchObject({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 't', arguments: { a: 1 } },
    });
    expect(typeof sent.id).toBe('string');
    expect(sent.id).toMatch(/[0-9a-f-]{10,}/i);

    expect(out).toEqual({ content: [{ type: 'text', text: 'ok' }] });
  });

  it('omits Authorization header when no bearer found', async () => {
    const req = makeReq('https://x/abc');
    readBearerMock.mockReturnValueOnce(null as unknown as ReturnType<typeof readBearerMock>);

    (fetch as unknown as Mock).mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { content: [] } }), { status: 200 }),
    );

    await callMcpTool(req as any, 't', {});
    const [, init] = (fetch as unknown as Mock).mock.calls[0] as [string, RequestInit];
    expect(Object.keys(init.headers as Record<string, string>)).not.toContain('authorization');
  });

  it('throws on non-OK HTTP with body', async () => {
    const req = makeReq('https://x/abc');
    readBearerMock.mockReturnValueOnce('tok' as unknown as ReturnType<typeof readBearerMock>);

    (fetch as unknown as Mock).mockResolvedValueOnce(new Response('nope', { status: 500 }));

    await expect(callMcpTool(req as any, 't', {})).rejects.toThrow(/MCP HTTP 500: nope/);
  });

  it('throws on non-JSON success body (parse error)', async () => {
    const req = makeReq('https://x/abc');
    readBearerMock.mockReturnValueOnce('tok' as unknown as ReturnType<typeof readBearerMock>);

    (fetch as unknown as Mock).mockResolvedValueOnce(new Response('not-json', { status: 200 }));

    await expect(callMcpTool(req as any, 't', {})).rejects.toThrow(/MCP non-JSON response/);
  });

  it('throws on JSON-RPC error object', async () => {
    const req = makeReq('https://x/abc');
    readBearerMock.mockReturnValueOnce('tok' as unknown as ReturnType<typeof readBearerMock>);

    (fetch as unknown as Mock).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 123, message: 'bad' } }), { status: 200 }),
    );

    await expect(callMcpTool(req as any, 't', {})).rejects.toThrow(/MCP RPC error 123: bad/);
  });

  it('accepts unwrapped result object (no .result root)', async () => {
    const req = makeReq('https://x/abc');
    readBearerMock.mockReturnValueOnce('tok' as unknown as ReturnType<typeof readBearerMock>);

    (fetch as unknown as Mock).mockResolvedValueOnce(
      new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }], isError: false }), {
        status: 200,
      }),
    );

    const out = await callMcpTool(req as any, 't', {});
    expect(out).toEqual({ content: [{ type: 'text', text: 'ok' }], isError: false });
  });
});

describe('formatToolResult', () => {
  it('joins text parts and trims', () => {
    const result = {
      content: [
        { type: 'text', text: ' First ' },
        { type: 'json', data: { x: 1 } },
        { type: 'text', text: 'Second' },
      ],
    };
    expect(formatToolResult(result)).toBe('First\nSecond');
  });

  it('synthesizes one-liner when only JSON is present', () => {
    const result = {
      content: [{ type: 'json', data: { a: 1, b: 'two', c: { z: true }, d: [1, 2], e: 5 } }],
    };
    const out = formatToolResult(result);
    expect(out.startsWith('Result: ')).toBe(true);
    expect(out).toMatch(/a=1/);
    expect(out).toMatch(/b=two/);
  });

  it('falls back to safeJson when no content text/json parts', () => {
    const result = { foo: 'bar' };
    const out = formatToolResult(result);
    expect(out).toContain('"foo": "bar"');
  });

  it('returns input string directly as last resort', () => {
    expect(formatToolResult('plain')).toBe('plain');
  });
});
