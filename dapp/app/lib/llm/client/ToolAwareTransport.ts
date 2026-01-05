// app/lib/llm/client/ToolAwareTransport.ts
'use client';

import { DefaultChatTransport } from 'ai';
import { useToolActivityStore } from '@store/toolActivity';

/**
 * Small helpers / local types
 */
type Metadata = Record<string, unknown>;
type ObjMap = Record<string, unknown>;

function isObject(x: unknown): x is ObjMap {
  return typeof x === 'object' && x !== null;
}

/**
 * Wrap DefaultChatTransport so we can:
 * 1. "Tee" the SSE stream and parse tool lifecycle events client-side
 * 2. Inject mode metadata into requests for server-side tool filtering
 */
export function createToolAwareTransport(opts: {
  api: string;
  headers?: Record<string, string>;
  getMetadata?: () => Metadata; // Function to get current metadata
  onSseError?: (errorText: string) => void;
}) {
  const { api, headers, getMetadata, onSseError } = opts;

  // Custom fetch that tees the SSE stream, parses events, AND injects metadata
  const toolAwareFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    // Inject metadata into request body if this is a POST to our chat endpoint
    const isOurEndpoint =
      typeof input === 'string'
        ? input.includes(api)
        : input instanceof URL
        ? input.pathname.includes(api)
        : (input as Request).url?.includes(api);

    const isPost = init?.method?.toLowerCase() === 'post';

    if (isOurEndpoint && isPost && init?.body && getMetadata) {
      try {
        const originalBody = JSON.parse(init.body as string) as ObjMap;
        const metadata = getMetadata();

        // Merge metadata into the request body
        const enhancedBody = {
          ...originalBody,
          metadata: {
            ...(originalBody.metadata as ObjMap) || {},
            ...metadata,
          },
        };

        init.body = JSON.stringify(enhancedBody);
      } catch (e) {
        // If we can't parse/modify the body, continue with original
        // keep behavior unchanged
        console.warn('Failed to inject metadata into request:', e);
      }
    }

    const res = await fetch(input, init);

    // Only tee for our chat endpoint + SSE bodies
    const isSSE = res.headers.get('content-type')?.includes('text/event-stream');

    if (!isOurEndpoint || !isSSE || !res.body) {
      return res;
    }

    const [toUi, toParser] = res.body.tee();

    // Kick off parser (fire-and-forget)
    parseToolEventsFromStream(toParser, onSseError).catch(() => {});

    // Return response with the UI branch
    const cloned = new Response(toUi, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });

    return cloned;
  };

  return new DefaultChatTransport({
    api,
    headers,
    fetch: toolAwareFetch,
  });
}

function pickResultLike(payload: unknown): unknown {
  // Some servers put the tool result under payload.output; others at top-level.
  if (isObject(payload) && 'output' in payload && isObject((payload as ObjMap).output)) {
    return (payload as ObjMap).output;
  }
  return payload;
}

function extractErrorText(resultLike: unknown): string | undefined {
  // Prefer explicit errorText
  if (isObject(resultLike) && typeof resultLike.errorText === 'string' && resultLike.errorText.trim()) {
    return (resultLike.errorText as string).trim();
  }

  // If there's a { content: [...] }, join text parts
  const content = isObject(resultLike) && Array.isArray(resultLike.content) ? (resultLike.content as unknown[]) : undefined;
  if (Array.isArray(content)) {
    const texts = content
      .filter((c): c is ObjMap => isObject(c) && c.type === 'text' && typeof c.text === 'string' && c.text.trim() !== '')
      .map((c) => (c.text as string).trim());
    if (texts.length) return texts.join('\n');
  }

  return undefined;
}

async function parseToolEventsFromStream(
  stream: ReadableStream<Uint8Array>,
  onSseError?: (errorText: string) => void
) {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let buffer = '';

  const {
    onSseStart,
    onToolInputStart,
    onToolInputAvailable,
    onToolOutputAvailable,
    onToolOutputPayload,
    onToolOutputError,
    onSseFinish,
  } = useToolActivityStore.getState();

  try {
    let result = await reader.read();
    while (!result.done) {
      const { value } = result;
      buffer += decoder.decode(value, { stream: true });

      // split SSE frames on blank line
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        // aggregate multiple data: lines per SSE event
        const dataLines = part
          .split('\n')
          .filter((l) => l.startsWith('data: '))
          .map((l) => l.slice(6).trim());

        if (dataLines.length === 0) continue;

        // handle [DONE]
        if (dataLines[0] === '[DONE]') {
          onSseFinish();
          continue;
        }

        let payload: unknown;
        try {
          // Vercel AI SDK v1 uses one JSON per event
          payload = JSON.parse(dataLines.join('\n')) as unknown;
        } catch {
          continue;
        }

        const payloadObj = isObject(payload) ? (payload as ObjMap) : undefined;
        const t = payloadObj && typeof payloadObj.type === 'string' ? (payloadObj.type as string) : undefined;

        switch (t) {
          case 'start': {
            const messageId = payloadObj && typeof payloadObj.messageId === 'string' ? (payloadObj.messageId as string) : undefined;
            onSseStart(messageId);
            break;
          }
          case 'error': {
            const errText =
              payloadObj && typeof payloadObj.errorText === 'string' && payloadObj.errorText.trim()
                ? (payloadObj.errorText as string).trim()
                : 'Stream error';
            if (onSseError) onSseError(errText);
            break;
          }
          case 'tool-input-start': {
            const id = payloadObj ? String(payloadObj.toolCallId ?? '') : '';
            const name = payloadObj ? String(payloadObj.toolName ?? 'tool') : 'tool';
            if (id) onToolInputStart(id, name);
            break;
          }
          case 'tool-input-available': {
            const id = payloadObj ? String(payloadObj.toolCallId ?? '') : '';
            const name = payloadObj ? String(payloadObj.toolName ?? 'tool') : 'tool';
            const input = payloadObj ? payloadObj.input : undefined;
            if (id) onToolInputAvailable(id, name, input);
            break;
          }
          case 'tool-output-available': {
            const id = payloadObj ? String(payloadObj.toolCallId ?? '') : '';
            if (id) {
              // Persist raw output payload (result object) for presenters
              if (payloadObj && 'output' in payloadObj) {
                onToolOutputPayload(id, (payloadObj.output as unknown));
              }

              // IMPORTANT: detect isError at either top-level or nested under .output
              const resultLike = pickResultLike(payloadObj);
              const isError =
                Boolean(payloadObj?.isError) ||
                Boolean(isObject(payloadObj) && Boolean((payloadObj.output as ObjMap | undefined)?.isError)) ||
                false;

              if (isError) {
                const errText = extractErrorText(resultLike) || 'Tool error';
                // Mark as error for the chip (and keep compatibility with listeners)
                onToolOutputAvailable(id, { isError: true, errorText: errText });
                onToolOutputError(id, errText);
              } else {
                onToolOutputAvailable(id, { isError: false });
              }
            }
            break;
          }
          case 'tool-output-error': {
            // Dedicated error frame (some servers emit this)
            const id = payloadObj ? String(payloadObj.toolCallId ?? '') : '';
            const resultLike = pickResultLike(payloadObj);
            const err = extractErrorText(resultLike) || 'Error';
            if (id) {
              onToolOutputAvailable(id, { isError: true, errorText: err });
              onToolOutputError(id, err);
            }
            break;
          }
          case 'finish': {
            onSseFinish();
            break;
          }
          default:
            // ignore other frame types (text-delta, etc.)
            break;
        }
      }
      result = await reader.read();
    }
  } finally {
    // on stream close, we don't force any extra state
  }
}
