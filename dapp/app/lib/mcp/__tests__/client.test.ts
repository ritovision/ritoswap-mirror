// dapp/app/lib/mcp/__tests__/client.test.ts

// ---------- Utility: TS-safe access to mocked fetch ----------
type VMock = ReturnType<typeof vi.fn>;
function getFetchMock(): VMock {
  return globalThis.fetch as unknown as VMock;
}

// ---------- Hoisted mocks (fix for "Cannot access before initialization") ----------
const hoisted = vi.hoisted(() => {
  return {
    toolMock: vi.fn((def: any) => ({ __mockTool: true, ...def })),
  };
});

// @logger mock
vi.mock('@logger', () => {
  const noop = vi.fn();
  return {
    createLogger: () => ({
      info: noop,
      debug: noop,
      error: noop,
      warn: noop,
    }),
  };
});

// ai.tool mock using hoisted.fn so it's defined before mock hoists
vi.mock('ai', () => ({ tool: hoisted.toolMock }));

// mock schemas used by client.ts; provide minimal shapes needed by tests
vi.mock('@schemas/dto/mcp', async () => {
  const { z } = await import('zod');

  const CallToolResultSchema = z.object({
    content: z.array(
      z.object({
        type: z.string(),
        text: z.string().optional(),
        data: z.unknown().optional(),
      })
    ),
    isError: z.boolean().optional(),
  });

  const ListToolsResultSchema = z.object({
    tools: z
      .array(
        z.object({
          name: z.string(),
          description: z.string().optional(),
          // inputSchema intentionally omitted for schema-less path
        })
      )
      .optional(),
  });

  return { CallToolResultSchema, ListToolsResultSchema };
});

// ---------- Imports under test ----------
import { MCPClient, fetchMCPTools, createMCPTools } from '../client';

describe('MCP client', () => {
  beforeEach(() => {
    vi.useRealTimers();
    // fresh fetch mock each test, with proper typing
    const f = vi.fn() as unknown as typeof fetch;
    vi.stubGlobal('fetch', f);

    // reset ai.tool mock
    hoisted.toolMock.mockReset();
    hoisted.toolMock.mockImplementation((def: any) => ({
      __mockTool: true,
      ...def,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('MCPClient.callTool', () => {
    it('sends correct payload and parses success', async () => {
      const endpoint = 'https://example.com/mcp';
      const client = new MCPClient({
        endpoint,
        requiresJwt: true,
        jwt: 'token-123',
        timeout: 5000,
      });

      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'hello' }],
        }),
      });

      const res = await client.callTool('echo', { message: 'hi' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(endpoint);
      expect(init.method).toBe('POST');

      const headers = init.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Authorization']).toBe('Bearer token-123');

      const body = JSON.parse(init.body as string);
      expect(body).toEqual({
        method: 'tools/call',
        params: { name: 'echo', arguments: { message: 'hi' } },
      });

      expect(res).toEqual({ content: [{ type: 'text', text: 'hello' }] });
    });

    it('throws on non-ok response with status text', async () => {
      const client = new MCPClient({
        endpoint: 'https://example.com/mcp',
        requiresJwt: false,
      });

      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('boom'),
      });

      await expect(client.callTool('bad')).rejects.toThrow(
        /MCP call failed 500: boom/
      );
    });

    it('aborts on timeout', async () => {
      vi.useFakeTimers();
      const client = new MCPClient({
        endpoint: 'https://example.com/mcp',
        requiresJwt: false,
        timeout: 10,
      });

      const fetchMock = getFetchMock();
      fetchMock.mockImplementation((_url: string, init: RequestInit) => {
        const signal = init.signal as AbortSignal | undefined;
        return new Promise((_resolve, reject) => {
          if (signal) {
            signal.addEventListener('abort', () => {
              const err = new Error('Aborted');
              (err as any).name = 'AbortError';
              reject(err);
            });
          }
        });
      });

      const p = client.callTool('will-timeout');
      vi.advanceTimersByTime(20);

      await expect(p).rejects.toThrow(/AbortError|aborted/i);
    });
  });

  describe('fetchMCPTools', () => {
    it('returns parsed tools and includes Authorization when jwt provided', async () => {
      const endpoint = 'https://example.com/mcp';
      const tools = [
        { name: 't1', description: 'Tool 1' },
        { name: 't2' },
      ];

      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ tools }),
      });

      const result = await fetchMCPTools(endpoint, 'jwt-abc');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(endpoint);
      expect(init.method).toBe('POST');

      const headers = init.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer jwt-abc');

      expect(result.map((t: any) => t.name)).toEqual(['t1', 't2']);
    });

    it('returns [] on non-ok response', async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValue({ ok: false, status: 403 });

      const result = await fetchMCPTools('https://example.com/mcp', null);
      expect(result).toEqual([]);
    });
  });

  describe('createMCPTools (schema-less hotfix)', () => {
    it('registers tools from wire and execute() proxies to client.callTool', async () => {
      const endpoint = 'https://example.com/mcp';

      const fetchMock = getFetchMock();
      // First call (tools/list) for fetchMCPTools
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          tools: [
            { name: 'alpha', description: 'Alpha tool' },
            { name: 'beta' },
          ],
        }),
      });

      // Mock client.callTool to avoid real fetch for tool execution
      const spy = vi
        .spyOn(MCPClient.prototype as any, 'callTool')
        .mockResolvedValue({
          content: [{ type: 'text', text: 'proxied-result' }],
        });

      const tools = await createMCPTools({
        endpoint,
        requiresJwt: false,
      });

      expect(Object.keys(tools).sort()).toEqual(['alpha', 'beta']);

      const out = await (tools as any).alpha.execute({ foo: 1 });
      expect(out).toBe('proxied-result');
      expect(spy).toHaveBeenCalledWith('alpha', { foo: 1 });
    });

    it('gracefully continues if a single tool registration throws', async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          tools: [{ name: 'ok' }, { name: 'bad' }],
        }),
      });

      vi.spyOn(MCPClient.prototype as any, 'callTool').mockResolvedValue({
        content: [{ type: 'text', text: 'ok' }],
      });

      // Make ai.tool throw for "bad" tool only
      hoisted.toolMock.mockImplementation((def: any) => {
        if ((def?.description as string | undefined)?.includes('bad')) {
          throw new Error('tool-factory-fail');
        }
        return { __mockTool: true, ...def };
      });

      const tools = await createMCPTools({
        endpoint: 'https://example.com/mcp',
        requiresJwt: false,
      });

      expect(Object.keys(tools)).toContain('ok');
    });
  });
});
