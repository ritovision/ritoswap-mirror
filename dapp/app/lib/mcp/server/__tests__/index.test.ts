// dapp/app/lib/mcp/server/__tests__/index.test.ts

vi.mock('@logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('@config/ai.public', () => ({
  aiPublicConfig: { requiresJwt: false },
}));

// In-memory registry lives INSIDE factory (hoist-safe)
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

vi.mock('../auth', () => ({
  verifyMCPAuth: vi.fn(),
}));

// Keep schema permissive so dispatcher doesn't blow up on parsing
vi.mock('@schemas/dto/mcp', () => ({
  MCPRequestSchema: { parse: (x: any) => x },
}));

import { MCPServer } from '../index';
import { MCPDispatcher } from '../dispatcher';
import { aiPublicConfig } from '@config/ai.public';
import { toolRegistry } from '../../tools';
import { verifyMCPAuth } from '../auth';

describe('MCPServer.handleRequest', () => {
  let server: MCPServer;
  const req = new Request('http://test');

  // Access mocked exports after import; cast to any to avoid TS noise
  const registry = toolRegistry as any;
  const verify = verifyMCPAuth as any;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    (aiPublicConfig as any).requiresJwt = false;
    registry.__clear();
    server = new MCPServer(); // fresh per test
  });

  it('returns 401 when global requiresJwt=true and auth fails', async () => {
  (aiPublicConfig as any).requiresJwt = true;
  const server = new MCPServer(); // construct AFTER flipping
  (verifyMCPAuth as any).mockResolvedValueOnce({ authenticated: false, error: 'nope' });

  const res = await server.handleRequest(req, {});
  expect(res.status).toBe(401);
  const body = await res.json();
  expect(body.error).toMatchObject({ code: -32001, message: 'nope' });
});
  it('returns 401 on per-tool precheck when tool.requiresJwt and auth fails', async () => {
    registry.__set('secure', { requiresJwt: true, tool: { name: 'secure' }, handler: vi.fn() });
    verify.mockResolvedValueOnce({ authenticated: false, error: 'fail' });

    const res = await server.handleRequest(req, {
      method: 'tools/call',
      params: { name: 'secure', arguments: {} },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatchObject({ code: -32001 });
  });

  it('delegates to dispatcher and returns 200 with its payload', async () => {
    const spy = vi.spyOn(MCPDispatcher.prototype, 'dispatch').mockResolvedValue({ ok: true } as any);

    const res = await server.handleRequest(req, { method: 'tools/list' });
    expect(spy).toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('returns 500 when dispatcher throws', async () => {
    vi.spyOn(MCPDispatcher.prototype, 'dispatch').mockRejectedValue(new Error('boom'));
    const res = await server.handleRequest(req, { method: 'tools/list' });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatchObject({ code: -32603 });
  });

  it('integration: secure tool path injects __jwt and returns handler result', async () => {
    const handler = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'hello' }],
      isError: false,
    });

    registry.__set('echo', { tool: { name: 'echo' }, requiresJwt: true, handler });

    verify.mockResolvedValue({
      authenticated: true,
      claims: { address: '0xabc', sub: 'user1' },
      tokenId: 't9',
    });

    const res = await server.handleRequest(req, {
      method: 'tools/call',
      params: { name: 'echo', arguments: { foo: 1 } },
      jwt: 'tok',
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.isError).toBe(false);

    const passedArgs = handler.mock.calls[0][0];
    expect(passedArgs.foo).toBe(1);
    expect(passedArgs.__jwt).toMatchObject({ address: '0xabc', sub: 'user1', tokenId: 't9' });
  });
});
