import type { Env } from '../types';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function unauthorized(message: string, status = 401) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: JSON_HEADERS,
  });
}

export async function handleStateRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  if (!env.STATE_STORE) {
    return unauthorized('State storage not configured', 500);
  }

  if (!env.STATE_SERVICE_AUTH_TOKEN) {
    return unauthorized('State auth token missing', 500);
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.STATE_SERVICE_AUTH_TOKEN}`) {
    return unauthorized('Unauthorized');
  }

  const body = await request.text();
  if (!body) {
    return unauthorized('Missing request body', 400);
  }

  const id = env.STATE_STORE.idFromName('global');
  const stub = env.STATE_STORE.get(id);

  const stubRequest = new Request('https://state.worker/internal', {
    method: 'POST',
    headers: new Headers({
      'content-type': request.headers.get('content-type') ?? 'application/json',
    }),
    body,
  });

  return stub.fetch(stubRequest);
}
