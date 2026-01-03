// Minimal logger
vi.mock('@logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// Global config used by verifyMCPAuth
vi.mock('@config/ai.public', () => ({
  aiPublicConfig: { requiresJwt: false },
}));

// Identity schemas for both client & server sides
vi.mock('@schemas/dto/mcp', () => ({
  MCPRequestSchema: { parse: (x: any) => x },
  CallToolResultSchema: { parse: (x: any) => x },
  ListToolsResultSchema: { parse: (x: any) => x },
}));

// In-memory tool registry (hoist-safe)
vi.mock('../../tools', () => {
  const registry = new Map<string, any>();
  return {
    toolRegistry: {
      get: (name: string) => registry.get(name),
      getAll: () => Array.from(registry.values()),
      __set: (name: string, def: any) => registry.set(name, def),
      __clear: () => registry.clear(),
    },
  };
});

// Cookies not needed here, keep it inert
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: () => undefined })),
}));

// JWT helpers used by server auth:
// - read from Authorization header
// - verify a known token ("tok")
vi.mock('@lib/jwt/server', () => {
  return {
    readBearerFromRequest: (req: Request) => {
      const h = req.headers.get('authorization') || req.headers.get('Authorization');
      if (!h) return null;
      const [, token] = h.split(' ');
      return token || null;
    },
    verifyAccessToken: vi.fn(async (token: string) => {
      if (token === 'tok') {
        return { payload: { sub: 'user1', address: '0xABC' }, tokenId: 't1' };
      }
      throw new Error('bad token');
    }),
  };
});

import { MCPServer } from '../index';
import { toolRegistry } from '../../tools';
import { MCPClient, fetchMCPTools } from '../../../mcp/client';
import { verifyAccessToken } from '@lib/jwt/server';
import { aiPublicConfig } from '@config/ai.public';

describe('MCP client ↔ server contract', () => {
  const registry = toolRegistry as any;
  let server: MCPServer;
  let originalFetch: typeof fetch;

  beforeAll(() => {
    registry.__clear();

    // Public tool
    registry.__set('echo', {
      tool: { name: 'echo', description: 'echoes', inputSchema: {} },
      handler: vi.fn(async (args: any) => ({
        content: [{ type: 'text', text: JSON.stringify(args ?? {}) }],
        isError: false,
      })),
    });

    // Secure tool (requires JWT → injects __jwt)
    const secureHandler = vi.fn(async (args: any) => ({
      content: [{ type: 'text', text: `secure-ok:${args?.__jwt?.address}` }],
      isError: false,
    }));
    registry.__set('secure', {
      tool: { name: 'secure', description: 'secure tool', inputSchema: {} },
      requiresJwt: true,
      handler: secureHandler,
    });

    server = new MCPServer({ requiresJwt: false });

    // Bridge global fetch → in-memory MCPServer
    originalFetch = global.fetch;
    global.fetch = async (url: any, init?: any) => {
      const req = new Request(String(url), init);
      const body = init?.body ? JSON.parse(init.body) : undefined;
      return server.handleRequest(req, body);
    };
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('lists tools (client → server)', async () => {
    const tools = await fetchMCPTools('http://local/mcp');
    expect(tools.map(t => t.name)).toEqual(['echo', 'secure']);
  });

  it('rejects secure tool without JWT (401 → client throws)', async () => {
    const client = new MCPClient({ endpoint: 'http://local/mcp', requiresJwt: true });
    await expect(client.callTool('secure', { x: 1 })).rejects.toThrow(/401/);
  });

  it('calls secure tool with JWT and injects __jwt', async () => {
    const client = new MCPClient({ endpoint: 'http://local/mcp', requiresJwt: true, jwt: 'tok' });
    const res = await client.callTool('secure', { x: 1 });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain('secure-ok:0xABC');
    expect((verifyAccessToken as any).mock.calls.length).toBeGreaterThan(0);
  });

  it('global requiresJwt=true also enforced', async () => {
    // flip global gate that verifyMCPAuth relies on
    (aiPublicConfig as any).requiresJwt = true;

    // construct AFTER flipping so server reads the global
    const locked = new MCPServer(); 
    const prev = global.fetch;
    global.fetch = async (url: any, init?: any) => {
      const req = new Request(String(url), init);
      const body = init?.body ? JSON.parse(init.body) : undefined;
      return locked.handleRequest(req, body);
    };

    const client = new MCPClient({ endpoint: 'http://local/mcp', requiresJwt: true });
    await expect(client.callTool('echo', { y: 2 })).rejects.toThrow(/401/);

    global.fetch = prev;
  });
});
