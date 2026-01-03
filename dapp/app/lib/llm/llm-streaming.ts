// app/lib/llm/llm-streaming.ts
import { randomUUID } from 'node:crypto';
import { concat } from '@langchain/core/utils/stream';
import { contentToText } from './message-converter';
import type { StreamingContext } from './types';

export type StreamResult = {
  gathered: unknown;
  totalText: string;
  textId: string;
  chunkCount: number;
};

type ChunkLike = {
  content?: unknown;
  tool_calls?: unknown;
};

export async function streamLLMResponse(
  stream: AsyncIterable<unknown>,
  context: StreamingContext,
  label: string = 'default'
): Promise<StreamResult> {
  const { parts, isClosed, logger } = context;
  const textId = `txt_${randomUUID()}`;

  let gathered: unknown = undefined;
  let totalText = '';
  let started = false;
  let chunkCount = 0;
  let lastFlushTime = Date.now();

  // Start text stream immediately
  parts.textStart(textId);
  started = true;
  logger.info(`[stream:${label}:text-start]`, { id: textId });

  try {
    for await (const chunk of stream) {
      if (isClosed()) break;

      // Accumulate for gathered result
      gathered = gathered ? concat(gathered, chunk) : chunk;

      // Extract text content from chunk
      const delta = contentToText((chunk as ChunkLike)?.content);

      if (delta) {
        // Send delta immediately - this is the fix for chunking
        parts.textDelta(textId, delta);
        totalText += delta;
        chunkCount++;

        // Log progress
        if (chunkCount === 1) {
          logger.info(`[stream:${label}:first-chunk]`, {
            len: delta.length,
            preview: delta.slice(0, 50),
          });
        }

        // Periodic progress logging
        if (chunkCount % 10 === 0) {
          const now = Date.now();
          const timeSinceLastFlush = now - lastFlushTime;
          lastFlushTime = now;

          logger.info(`[stream:${label}:progress]`, {
            chunkCount,
            cumLen: totalText.length,
            timeSinceLastFlush,
          });
        }
      }

      // Handle tool calls in chunks if present
      const toolCalls = (chunk as ChunkLike)?.tool_calls;
      if (Array.isArray(toolCalls) && toolCalls.length > 0) {
        logger.info(`[stream:${label}:tool-calls-in-chunk]`, {
          count: toolCalls.length,
        });
      }
    }
  } catch (error) {
    logger.error(`[stream:${label}:error]`, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    // Always close the text stream if started
    if (!isClosed() && started) {
      parts.textEnd(textId);
      logger.info(`[stream:${label}:text-end]`, {
        id: textId,
        totalChars: totalText.length,
        totalChunks: chunkCount,
      });
    }
  }

  return { gathered, totalText, textId, chunkCount };
}
