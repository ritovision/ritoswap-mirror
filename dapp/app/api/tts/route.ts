// app/api/tts/route.ts
import { NextRequest } from 'next/server';
import { createLogger } from '@logger';
import { aiServerConfig } from '@config/ai.server';
import { getTtsProvider } from '@lib/tts/providers/registry';
import { readJwtFromAny, verifyAccessToken } from '@lib/jwt/server';

export const runtime = 'nodejs';

const logger = createLogger('tts-route');

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const rawText = (body as { text?: unknown })?.text;
  const text = typeof rawText === 'string' ? rawText.trim() : '';
  const messageId = typeof (body as { messageId?: unknown })?.messageId === 'string'
    ? (body as { messageId?: string }).messageId
    : undefined;

  if (!text) {
    return jsonResponse(400, { error: 'Missing "text"' });
  }

  if (aiServerConfig.requiresJwt) {
    const bearerToken = readJwtFromAny(req as unknown as Request, body);
    if (!bearerToken) {
      return jsonResponse(401, { error: 'Unauthorized: missing JWT' });
    }
    try {
      await verifyAccessToken(bearerToken);
    } catch (e: unknown) {
      logger.warn('[auth] invalid JWT', { error: getErrorMessage(e) });
      return jsonResponse(401, { error: 'Unauthorized: invalid JWT' });
    }
  }

  try {
    const provider = getTtsProvider();
    const result = await provider.synthesize(text);
    return new Response(result.audio, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Cache-Control': 'no-store',
        'X-Message-Id': messageId ?? '',
      },
    });
  } catch (e: unknown) {
    const message = getErrorMessage(e);
    const status = message.toLowerCase().includes('disabled') ? 503 : 500;
    logger.error('[tts:error]', { message, messageId });
    return jsonResponse(status, { error: 'TTS generation failed', details: message });
  }
}
