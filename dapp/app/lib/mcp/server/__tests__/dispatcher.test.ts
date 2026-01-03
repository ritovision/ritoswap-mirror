// dapp/app/lib/mcp/server/__tests__/dispatcher.test.ts

vi.mock('@logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('@schemas/dto/mcp', () => ({
  // Keep schema permissive for unit tests
  MCPRequestSchema: { parse: (x: any) => x },
}));

// Create the in-memory registry INSIDE the factory and expose helpers
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

// auth mock with vi.fn created inside the factory
vi.mock('../auth', () => ({
  verifyMCPAuth: vi.fn(),
}));

import { MCPDispatcher } from '../dispatcher';
import { toolRegistry } from '../../tools';
import { verifyMCPAuth } from '../auth';

describe('MCPDispatcher', () => {
  const dispatcher = new MCPDispatcher();
  const req = new Request('http://test');

  const registry = toolRegistry as any;
  const verify = verifyMCPAuth as any;

  beforeEach(() => {
    vi.clearAllMocks();
    registry.__clear();
  });

  it('handles tools/list', async () => {
    registry.__set('t1', { tool: { name: 't1' }, handler: vi.fn() });
    registry.__set('t2', { tool: { name: 't2' }, handler: vi.fn() });

    const res: any = await dispatcher.dispatch(req, { method: 'tools/list' });
    expect(res.tools.map((t: any) => t.name)).toEqual(['t1', 't2']);
  });

  it('returns error when method unknown or validation fails', async () => {
    const res: any = await dispatcher.dispatch(req, { method: 'nope' });
    expect(res.error).toBeTruthy();
    expect(res.error.code).toBe(-32603);
  });

  it('returns error when tool not found', async () => {
    const res: any = await dispatcher.dispatch(req, {
      method: 'tools/call',
      params: { name: 'missing', arguments: {} },
    });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/Tool not found/);
  });

  it('requires per-tool auth when requiresJwt=true and returns error if not authenticated', async () => {
    registry.__set('secure', { tool: { name: 'secure' }, requiresJwt: true, handler: vi.fn() });
    verify.mockResolvedValue({ authenticated: false, error: 'nope' });

    const res: any = await dispatcher.dispatch(req, {
      method: 'tools/call',
      params: { name: 'secure', arguments: { a: 1 } },
    });
    expect(verify).toHaveBeenCalled();
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/Authentication required|nope/);
  });

  it('injects __jwt and merges args', async () => {
    const handler = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }], isError: false });
    registry.__set('secure', { tool: { name: 'secure' }, requiresJwt: true, handler });

    verify.mockResolvedValue({
      authenticated: true,
      claims: { sub: 'user123', addr: '0xaddr', address: '0xADDRESS' }, // address wins
      tokenId: 'tX',
    });

    const res: any = await dispatcher.dispatch(req, {
      method: 'tools/call',
      params: { name: 'secure', arguments: { a: 1, b: 2 } },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const passedArgs = handler.mock.calls[0][0];
    expect(passedArgs).toMatchObject({
      a: 1,
      b: 2,
      __jwt: { address: '0xADDRESS', sub: 'user123', tokenId: 'tX' },
    });
    expect(res.isError).toBe(false);
  });

  it('handles tool handler throwing', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('boom'));
    registry.__set('t', { tool: { name: 't' }, handler });
    const res: any = await dispatcher.dispatch(req, { method: 'tools/call', params: { name: 't' } });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/Tool execution failed: boom/);
  });
});
