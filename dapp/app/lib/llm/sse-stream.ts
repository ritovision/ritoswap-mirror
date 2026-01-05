// app/lib/llm/sse-stream.ts
import { createLogger } from '@logger';
import type { SseInit, DataStreamParts } from './types';

const logger = createLogger('sse-stream');

export function sseInit(): SseInit {
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;
  const pending: Uint8Array[] = [];

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      // Flush any pending messages
      while (pending.length && !closed) {
        try {
          controllerRef.enqueue(pending.shift()!);
        } catch (e: unknown) {
          closed = true;
          logger.warn('[flush:error]', { error: e instanceof Error ? e.message : String(e) });
          break;
        }
      }
    },
    cancel(reason: unknown) {
      if (!closed) {
        closed = true;
        logger.warn('[cancel]', { reason: String(reason) });
      }
    },
  });

  const enqueueSafe = (obj: unknown): boolean => {
    if (closed) return false;
    
    // Format as SSE data
    const chunk = encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
    
    try {
      if (controllerRef) {
        // Direct enqueue for immediate sending
        controllerRef.enqueue(chunk);
      } else {
        // Buffer if controller not ready yet
        pending.push(chunk);
      }
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('already closed')) {
        closed = true;
        logger.warn('[enqueue:closed]');
        return false;
      }
      logger.error('[enqueue:error]', { error: msg });
      return false;
    }
  };

  const done = () => {
    if (closed) return;
    const chunk = encoder.encode(`data: [DONE]\n\n`);
    try {
      if (controllerRef) {
        controllerRef.enqueue(chunk);
      } else {
        pending.push(chunk);
      }
    } catch {
      // no-op
    }
  };

  const finish = () => {
    if (closed) return;
    enqueueSafe({ type: 'finish' });
    done();
    closed = true;
    try {
      controllerRef?.close();
    } catch {
      // no-op
    }
  };

  const parts: DataStreamParts = {
    start: (messageId: string) => enqueueSafe({ type: 'start', messageId }),
    startStep: () => enqueueSafe({ type: 'start-step' }),
    finishStep: () => enqueueSafe({ type: 'finish-step' }),

    textStart: (id) => enqueueSafe({ type: 'text-start', id }),
    textDelta: (id, delta) => {
      // Immediately send text deltas for smooth streaming
      return enqueueSafe({ type: 'text-delta', id, delta });
    },
    textEnd: (id) => enqueueSafe({ type: 'text-end', id }),

    toolInputStart: (toolCallId, toolName) =>
      enqueueSafe({ type: 'tool-input-start', toolCallId, toolName }),
    toolInputDelta: (toolCallId, inputTextDelta) =>
      enqueueSafe({ type: 'tool-input-delta', toolCallId, inputTextDelta }),
    toolInputAvailable: (toolCallId, toolName, input) =>
      enqueueSafe({ type: 'tool-input-available', toolCallId, toolName, input }),
    toolInputError: (toolCallId, errorText) =>
      enqueueSafe({ type: 'tool-input-error', toolCallId, errorText }),

    toolOutputAvailable: (toolCallId, output) =>
      enqueueSafe({ type: 'tool-output-available', toolCallId, output }),
    toolOutputError: (toolCallId, errorText) =>
      enqueueSafe({ type: 'tool-output-error', toolCallId, errorText }),

    error: (errorText) => enqueueSafe({ type: 'error', errorText }),
    finish,
    done,
  };

  return { stream, parts, isClosed: () => closed };
}

export function createSseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Important: disable buffering for immediate streaming
      'X-Accel-Buffering': 'no',
      // Vercel AI SDK compatibility
      'x-vercel-ai-ui-message-stream': 'v1',
    },
  });
}
