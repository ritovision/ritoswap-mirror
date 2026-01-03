// dapp/app/api/mcp/__tests__/route.test.ts

// Quiet logger
vi.mock('@logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// Mutable server config
vi.mock('@config/ai.server', () => ({
  aiServerConfig: { requiresJwt: false },
}));

// JWT helpers mocked inside factory (hoist-safe)
vi.mock('@lib/jwt/server', () => ({
  readJwtFromAny: vi.fn(),
  verifyAccessToken: vi.fn(),
}));

// MCP server mocked with handleRequest
vi.mock('@lib/mcp/server', () => ({
  mcpServer: {
    handleRequest: vi.fn(),
  },
}));

import { POST, GET } from '../route';
import { aiServerConfig } from '@config/ai.server';
import { readJwtFromAny, verifyAccessToken } from '@lib/jwt/server';
import { mcpServer } from '@lib/mcp/server';

const jwtRead = readJwtFromAny as any;
const jwtVerify = verifyAccessToken as any;
const handle = mcpServer.handleRequest as any;

describe('api/mcp route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (aiServerConfig as any).requiresJwt = false;
  });

  it('returns 400 with parse error when JSON body invalid', async () => {
    const req = new Request('http://test/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ bad json',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({
      error: { code: -32700, message: 'Parse error' },
    });
    expect(handle).not.toHaveBeenCalled();
  });

  it('401 when requiresJwt=true and missing JWT', async () => {
    (aiServerConfig as any).requiresJwt = true;
    jwtRead.mockReturnValue(null);

    const body = { method: 'tools/list' };
    const req = new Request('http://test/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ error: 'Unauthorized: missing JWT' });
    expect(handle).not.toHaveBeenCalled();
  });

  it('401 when requiresJwt=true and JWT invalid', async () => {
    (aiServerConfig as any).requiresJwt = true;
    jwtRead.mockReturnValue('tok');
    jwtVerify.mockRejectedValue(new Error('nope'));

    const body = { method: 'tools/list' };
    const req = new Request('http://test/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ error: 'Unauthorized: invalid JWT' });
    expect(handle).not.toHaveBeenCalled();
  });

  it('delegates to mcpServer.handleRequest on success and returns its response', async () => {
    (aiServerConfig as any).requiresJwt = true;
    jwtRead.mockReturnValue('tok');
    jwtVerify.mockResolvedValue({}); // valid

    const body = { method: 'tools/list' };
    const req = new Request('http://test/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Simulate MCP server returning a 200 with payload
    handle.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(handle).toHaveBeenCalledTimes(1);

    // Args: original Request + parsed body
    const [passedReq, passedBody] = handle.mock.calls[0];
    expect(passedReq).toBeInstanceOf(Request);
    expect(passedBody).toEqual(body);

    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });

  it('GET returns 405 and helpful message', async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST');
    const json = await res.json();
    expect(json).toMatchObject({
      error: 'MCP endpoint only supports POST requests',
    });
  });
});
