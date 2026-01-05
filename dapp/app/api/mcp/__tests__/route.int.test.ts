// dapp/app/api/mcp/__tests__/route.int.test.ts
import { aiServerConfig } from '@config/ai.server';
import { readJwtFromAny } from '@lib/jwt/server';

// Quiet logs
vi.mock('@logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// Route-level JWT gate OFF so request hits MCP stack
vi.mock('@config/ai.server', () => ({
  aiServerConfig: { requiresJwt: false },
}));

// In-memory tool registry used by server/dispatcher
vi.mock('@lib/mcp/tools', () => {
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

// JWT helpers used by both route (we bypass) and auth.ts (we use)
vi.mock('@lib/jwt/server', () => ({
  readJwtFromAny: vi.fn(),              // not used in this test (route gate off)
  readBearerFromRequest: vi.fn(),       // used by verifyMCPAuth
  verifyAccessToken: vi.fn(),           // used by verifyMCPAuth
}));

// Keep schema permissive so dispatcher accepts our body
vi.mock('@schemas/dto/mcp', () => ({
  MCPRequestSchema: { parse: (x: any) => x },
}));

import { POST } from '../route';
import { toolRegistry } from '@lib/mcp/tools';
import { readBearerFromRequest, verifyAccessToken } from '@lib/jwt/server';

describe('api/mcp integration', () => {
  const registry = toolRegistry as any;
  const bearer = readBearerFromRequest as any;
  const verify = verifyAccessToken as any;

  beforeEach(() => {
    vi.clearAllMocks();
    registry.__clear();
  });

  it('flows route → server → dispatcher → auth → tool, injects __jwt', async () => {
    // Register a secure tool
    const handler = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      isError: false,
    });
    registry.__set('secureEcho', { tool: { name: 'secureEcho' }, requiresJwt: true, handler });

    // Auth path: dispatcher/auth reads from Authorization header & verifies token
    bearer.mockReturnValue('tok');
    verify.mockResolvedValue({
      payload: { sub: 'user42', address: '0xABCDEF' },
      tokenId: 't-123',
    });

    const body = {
      method: 'tools/call',
      params: { name: 'secureEcho', arguments: { msg: 'hello' } },
    };

    const req = new Request('http://test/api/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: 'Bearer tok',
      },
      body: JSON.stringify(body),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.isError).toBe(false);
    expect(json.content?.[0]?.text).toBe('ok');

    // Ensure injected __jwt reached the handler via dispatcher
    const passedArgs = handler.mock.calls[0][0];
    expect(passedArgs).toMatchObject({
      msg: 'hello',
      __jwt: { address: '0xABCDEF', sub: 'user42', tokenId: 't-123' },
    });
  });

  it('returns 401 and stops before MCP when route requires JWT and token is missing', async () => {
  // Turn ON route-level gate
  (aiServerConfig as any).requiresJwt = true;

  // Make route think there is no token
  const readAny = readJwtFromAny as any;
  readAny.mockReturnValue(null);

  // Register a tool — we assert its handler is NOT called
  const handler = vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'should-not-run' }],
    isError: false,
  });
  (toolRegistry as any).__set('secureEcho', { tool: { name: 'secureEcho' }, requiresJwt: true, handler });

  const body = {
    method: 'tools/call',
    params: { name: 'secureEcho', arguments: { msg: 'hello' } },
  };

  const req = new Request('http://test/api/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const res = await POST(req);

  expect(res.status).toBe(401);
  const json = await res.json();
  expect(json).toEqual({ error: 'Unauthorized: missing JWT' });

  // Ensure we never reached MCP stack / tool handler
  expect(handler).not.toHaveBeenCalled();
});
});
