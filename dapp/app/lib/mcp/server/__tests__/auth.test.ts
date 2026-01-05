// dapp/app/lib/mcp/server/__tests__/auth.test.ts

// Mocks must be created inside the factory (no top-level refs).
vi.mock('@logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// Make the config mutable in tests
vi.mock('@config/ai.public', () => ({ aiPublicConfig: { requiresJwt: false } }));

// Create the function mocks INSIDE the factory to avoid hoist issues
vi.mock('@lib/jwt/server', () => ({
  readBearerFromRequest: vi.fn(),
  verifyAccessToken: vi.fn(),
}));

// cookies mock also created in-factory
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import { verifyMCPAuth } from '../auth';
import { aiPublicConfig } from '@config/ai.public';
import { readBearerFromRequest, verifyAccessToken } from '@lib/jwt/server';
import { cookies } from 'next/headers';

const readBearerMock = readBearerFromRequest as any;
const verifyAccessTokenMock = verifyAccessToken as any;
const cookiesMock = cookies as any;

describe('verifyMCPAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (aiPublicConfig as any).requiresJwt = false;
  });

  it('returns authenticated=true when global requiresJwt=false and not forced', async () => {
    const req = new Request('http://test');
    const res = await verifyMCPAuth(req);
    expect(res).toEqual({ authenticated: true });
    expect(readBearerMock).not.toHaveBeenCalled();
  });

  it('forces verification when opts.force=true regardless of global toggle', async () => {
    const req = new Request('http://test');
    readBearerMock.mockReturnValue('tok');
    verifyAccessTokenMock.mockResolvedValue({
      payload: { sub: 'user123', address: '0xabc' },
      tokenId: 't1',
    });

    const res = await verifyMCPAuth(req, undefined, { force: true });
    expect(readBearerMock).toHaveBeenCalled();
    expect(verifyAccessTokenMock).toHaveBeenCalledWith('tok');
    expect(res).toMatchObject({
      authenticated: true,
      tokenId: 't1',
      claims: { sub: 'user123', address: '0xabc' },
    });
  });

  it('uses body.jwt when no Authorization header', async () => {
    const req = new Request('http://test');
    readBearerMock.mockReturnValue(null);
    verifyAccessTokenMock.mockResolvedValue({ payload: {}, tokenId: 't2' });

    const res = await verifyMCPAuth(req, { jwt: 'tok' }, { force: true });
    expect(verifyAccessTokenMock).toHaveBeenCalledWith('tok');
    expect(res.authenticated).toBe(true);
  });

  it('uses body.data.jwt as a fallback', async () => {
    const req = new Request('http://test');
    readBearerMock.mockReturnValue(null);
    verifyAccessTokenMock.mockResolvedValue({ payload: {}, tokenId: 't3' });

    const res = await verifyMCPAuth(req, { data: { jwt: 'tok' } }, { force: true });
    expect(verifyAccessTokenMock).toHaveBeenCalledWith('tok');
    expect(res.authenticated).toBe(true);
  });

  it('uses cookies as a fallback', async () => {
    const req = new Request('http://test');
    readBearerMock.mockReturnValue(null);
    cookiesMock.mockReturnValue({
      get: (name: string) => (name === 'access_token' ? { value: 'tok' } : undefined),
    });
    verifyAccessTokenMock.mockResolvedValue({ payload: { sub: 'x' }, tokenId: 't4' });

    const res = await verifyMCPAuth(req, undefined, { force: true });
    expect(verifyAccessTokenMock).toHaveBeenCalledWith('tok');
    expect(res).toMatchObject({ authenticated: true, tokenId: 't4' });
  });

  it('returns error when missing token', async () => {
    const req = new Request('http://test');
    readBearerMock.mockReturnValue(null);
    cookiesMock.mockReturnValue({ get: () => undefined });

    const res = await verifyMCPAuth(req, {}, { force: true });
    expect(res).toEqual({ authenticated: false, error: 'Authentication required: missing JWT' });
  });

  it('returns error when verification throws', async () => {
    const req = new Request('http://test');
    readBearerMock.mockReturnValue('tok');
    verifyAccessTokenMock.mockRejectedValue(new Error('bad'));

    const res = await verifyMCPAuth(req, undefined, { force: true });
    expect(res).toEqual({ authenticated: false, error: 'Authentication failed: invalid JWT' });
  });
});
