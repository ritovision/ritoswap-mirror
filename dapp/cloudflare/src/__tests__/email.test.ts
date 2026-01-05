import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleEmailRequest } from '../routes/email';
import type { Env } from '../types';

const baseEnv: Env = {
  BREVO_API_KEY: 'test-key',
  SENDER_EMAIL: 'sender@example.com',
  RECEIVER_EMAIL: 'receiver@example.com',
  STATE_SERVICE_AUTH_TOKEN: 'auth',
  STATE_STORE: {} as unknown as DurableObjectNamespace,
};

const createRequest = (body: Record<string, unknown>, init?: RequestInit) =>
  new Request('https://worker/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...init,
  });

describe('handleEmailRequest', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects non-POST requests', async () => {
    const res = await handleEmailRequest(
      new Request('https://worker/email', { method: 'GET' }),
      baseEnv,
    );
    expect(res.status).toBe(405);
  });

  it('sends email via Brevo and returns success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messageId: 'abc123' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const payload = {
      tokenId: '1',
      message: 'Hello!',
      address: '0x1234567890abcdef1234567890ABCDEF12345678',
      timestamp: Date.now(),
    };

    const res = await handleEmailRequest(createRequest(payload), baseEnv);
    expect(res.status).toBe(200);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/smtp/email',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'api-key': baseEnv.BREVO_API_KEY,
        }),
      }),
    );

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.messageId).toBe('abc123');
  });

  it('propagates Brevo errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'bad' }), { status: 500 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await handleEmailRequest(
      createRequest({
        tokenId: '1',
        message: 'fail me',
        address: '0x1234567890abcdef1234567890ABCDEF12345678',
        timestamp: Date.now(),
      }),
      baseEnv,
    );
    expect(res.status).toBe(502);
  });

  it('returns 400 when required fields missing', async () => {
    const res = await handleEmailRequest(
      createRequest({
        tokenId: '',
        message: '',
        address: '',
        timestamp: Date.now(),
      }),
      baseEnv,
    );
    expect(res.status).toBe(400);
  });
});
