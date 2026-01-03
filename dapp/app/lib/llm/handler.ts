// app/lib/llm/handler.ts
import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { AIMessage, ToolMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ToolCall as LCToolCall } from '@langchain/core/messages/tool';
import type { UiMessage } from './types';
import { createLogger } from '@logger';

import { sseInit, createSseResponse } from './sse-stream';
import { asArray, isString } from './utils';
import { 
  buildSystemPrompt, 
  convertUiToModelMessages, 
  summarizeMessages 
} from './message-converter';
import { 
  getOpenAIToolSchemas, 
  callMcpTool, 
  formatToolResult 
} from './tool-bridge';
import { streamLLMResponse } from './llm-streaming';
import { providerRegistry } from './providers/registry';
import { aiServerConfig } from '@/app/config/ai.server';
import type { ChatMode } from './modes/types';
import { verifyAccessToken, readJwtFromAny } from '@lib/jwt/server';
import {
  isQuotaFeatureActive,
  ensureAndCheck,
  addUsage,
  estimateInputTokensFromModelMessages,
  estimateTokensFromText,
} from '@lib/quotas/token-quota';

const logger = createLogger('chat-handler');

// Narrow helpers
type LocalToolCall = { id?: string; name?: string; args?: unknown };
function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
function getErrorStack(e: unknown): string | undefined {
  return e instanceof Error ? e.stack : undefined;
}
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function extractToolCalls(gathered: unknown): LocalToolCall[] {
  if (gathered && typeof gathered === 'object' && 'tool_calls' in (gathered as Record<string, unknown>)) {
    const tc = (gathered as { tool_calls?: unknown }).tool_calls;
    if (Array.isArray(tc)) return tc as LocalToolCall[];
  }
  return [];
}
function normalizeToolCalls(toolCalls: LocalToolCall[]): LCToolCall[] {
  return toolCalls.map(tc => {
    const rawArgs = isPlainObject(tc.args) ? (tc.args as Record<string, unknown>) : {};
    // LangChain's ToolCall requires args: Record<string, any>.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required to satisfy external LangChain ToolCall.args type
    const args = rawArgs as unknown as Record<string, any>;
    return {
      id: tc.id ?? `call_${randomUUID()}`,
      name: typeof tc.name === 'string' ? tc.name : 'tool',
      args,
    };
  });
}
function hasBindTools(x: unknown): x is { bindTools: (tools: unknown) => BaseChatModel } {
  return !!x && typeof (x as { bindTools?: unknown }).bindTools === 'function';
}

// Dynamic default system based on provider
function getDefaultSystem(): string {
  const provider = aiServerConfig.provider;
  const model = aiServerConfig.models[0]; // Use first model as default
  
  return `You are a helpful AI assistant powered by ${provider} (${model}) for the RitoSwap dApp made by Rito aka Rito Rhymes, owner of RitoVision. The following system instructions will guide your role and responses.`;
}

export async function handleChatRequest(req: NextRequest): Promise<Response> {
  const t0 = Date.now();

  try {
    // ===== Parse Request JSON up front (before opening SSE) =====
    const body: unknown = await req.json();
    const uiMessages = asArray<UiMessage>((body as { messages?: unknown }).messages);
    const metadata = (body as { metadata?: Record<string, unknown> }).metadata ?? {};
    const requestedModel = (body as { model?: unknown }).model;
    const useModel = isString(requestedModel) ? requestedModel : undefined;
    const modelIndex =
      typeof (body as { modelIndex?: unknown }).modelIndex === 'number'
        ? (body as { modelIndex: number }).modelIndex
        : 1; // Default to model 1

    // ===== Extract mode from metadata for tool filtering =====
    const mode = ((metadata as { mode?: unknown })?.mode as ChatMode | undefined) || undefined;

    // ===== Optional JWT enforcement =====
    let bearerToken: string | null = null;
    let tokenId: string | undefined;

    if (aiServerConfig.requiresJwt) {
      bearerToken = readJwtFromAny(req as unknown as Request, body);
      if (!bearerToken) {
        logger.warn('[auth] missing JWT (header/body/cookies/query)');
        return new Response(JSON.stringify({ error: 'Unauthorized: missing JWT' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      try {
        const verified = await verifyAccessToken(bearerToken);
        tokenId = verified.payload.tokenId;
        logger.info('[auth] JWT verified', { sub: verified.payload.sub, hasTokenId: Boolean(tokenId) });
      } catch (e: unknown) {
        logger.warn('[auth] invalid JWT', { error: getErrorMessage(e) });
        return new Response(JSON.stringify({ error: 'Unauthorized: invalid JWT' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      // JWT not required, but we may still forward if present
      bearerToken = readJwtFromAny(req as unknown as Request, body);
    }

    // ===== Basic body validation =====
    if (uiMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing "messages" array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const defaultSystem = getDefaultSystem();
    const systemPrompt = buildSystemPrompt(uiMessages, metadata, defaultSystem);
    const modelMessages = convertUiToModelMessages(uiMessages, systemPrompt);

    // ===== Quota PRE-CHECK (only when JWT is required AND Redis is active AND tokenId present) =====
    const quotaShouldApply = aiServerConfig.requiresJwt && isQuotaFeatureActive() && !!tokenId;

    if (quotaShouldApply) {
      const pre = await ensureAndCheck(tokenId!, {
        limit: aiServerConfig.quota.tokens,
        durationSec: aiServerConfig.quota.windowSec,
      });
      if (!pre.allowed) {
        logger.info('[quota] exhausted pre-check', {
          tokenId,
          used: pre.window.used,
          limit: pre.window.limit,
          remaining: pre.remaining,
          resetAt: pre.window.resetAt,
        });
        return new Response(
          JSON.stringify({
            error: 'Quota exceeded',
            remaining: 0,
            resetAt: pre.window.resetAt,
          }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
    }

    // ===== From here on: start SSE streaming =====
    const { stream, parts, isClosed } = sseInit();
    const response = createSseResponse(stream);

    // Start async processing
    (async () => {
      let initialOutText = '';
      let followupOutText = '';
      const messageId = `msg_${randomUUID()}`;
      const tStart = Date.now();
      const maxDurationSec =
        typeof aiServerConfig.limits.maxDurationSec === 'number' &&
        Number.isFinite(aiServerConfig.limits.maxDurationSec)
          ? aiServerConfig.limits.maxDurationSec
          : 30;
      const maxDurationMs = Math.max(1000, maxDurationSec * 1000);
      const softTimeoutMs = Math.max(1000, maxDurationMs - 3000);
      let timedOut = false;
      const timeoutId = setTimeout(() => {
        if (isClosed()) return;
        timedOut = true;
        logger.warn('[timeout]', { softTimeoutMs, maxDurationMs });
        parts.error(`Request timed out after ${Math.round(softTimeoutMs / 1000)}s`);
        parts.finish();
      }, softTimeoutMs);

      const isAborted = () => timedOut || isClosed();

      try {
        logger.info('[request:start]', {
          url: req.url,
          provider: aiServerConfig.provider,
          configuredModels: aiServerConfig.models,
          requestedModel: useModel,
          modelIndex,
          messagesLen: uiMessages.length,
          firstRole: uiMessages[0]?.role,
          lastRole: uiMessages.at(-1)?.role,
          jwtRequired: aiServerConfig.requiresJwt,
          quotaShouldApply,
          mode: mode || 'none',
        });

        logger.info('[messages:prepared]', summarizeMessages(modelMessages));

        // ===== Initialize LLM =====
        const llm = providerRegistry.getProvider({
          model: useModel,
          modelIndex: modelIndex, // Use model index (defaults to 1)
          streaming: true,
          maxTokens: aiServerConfig.limits.maxOutputTokens,
        });

        // ===== Bind tools if available WITH MODE FILTERING =====
        const openAiTools = getOpenAIToolSchemas(mode);
        logger.info('[tools] Tool schemas prepared', {
          mode: mode || 'none',
          toolCount: openAiTools.length,
          toolNames: openAiTools.map(t => t.function.name),
        });

        const withTools: BaseChatModel = hasBindTools(llm)
          ? (llm.bindTools(openAiTools) as BaseChatModel)
          : llm;

        // Start SSE message
        parts.start(messageId);

        // ===== STEP 1: Initial LLM Call =====
        parts.startStep();
        logger.info('[llm:initial:start]', {
          provider: aiServerConfig.provider,
          model: useModel || aiServerConfig.getModel(modelIndex),
          hasTools: openAiTools.length > 0,
          mode: mode || 'none',
        });

        const ttftStart = Date.now();
        const initialStream = await withTools.stream(modelMessages);
        logger.info('[llm:initial:stream-open]', { ttftWaitMs: Date.now() - ttftStart });

        const initialResult = await streamLLMResponse(
          initialStream,
          { parts, isClosed: isAborted, logger },
          'initial'
        );
        initialOutText = initialResult.totalText;
        parts.finishStep();

        // ===== STEP 2: Process Tool Calls (if any) =====
        const toolCalls = extractToolCalls(initialResult.gathered);

        if (!isAborted() && toolCalls.length > 0) {
          logger.info('[tools:detected]', { count: toolCalls.length });
          const toolMessages: ToolMessage[] = [];

          for (const call of toolCalls) {
            if (isAborted()) break;

            const toolCallId = call.id || `call_${randomUUID()}`;
            const toolName = typeof call.name === 'string' ? call.name : 'tool';
            const toolInput = call.args ?? {};

            parts.toolInputStart(toolCallId, toolName);
            parts.toolInputAvailable(toolCallId, toolName, toolInput);
            logger.info('[tool:call:start]', { toolCallId, toolName });

            let result: unknown;
            let isError = false;

            try {
              // ⬇️ Forward bearer so MCP can enforce auth if configured
              result = await callMcpTool(req, toolName, toolInput, bearerToken || undefined);
              logger.info('[tool:call:success]', { toolCallId, toolName, hasResult: result != null });
            } catch (err: unknown) {
              isError = true;
              const errorMsg = getErrorMessage(err);
              logger.error('[tool:call:error]', { toolCallId, toolName, error: errorMsg });
              parts.toolOutputError(toolCallId, errorMsg);
              result = { 
                content: [{ type: 'text', text: `Error: ${errorMsg}` }], 
                isError: true 
              };
            }

            if (!isAborted() && !isError && result) {
              parts.toolOutputAvailable(toolCallId, result);
            }

            const textOutput = formatToolResult(result);
            logger.info('[tool:result:formatted]', { toolCallId, toolName, textLength: textOutput.length });

            toolMessages.push(
              new ToolMessage({
                content: textOutput,
                tool_call_id: toolCallId,
                name: toolName,
              })
            );
          }

          // ===== STEP 3: Follow-up LLM Call with Tool Results =====
          if (!isAborted() && toolMessages.length > 0) {
            parts.startStep();

            const assistantWithTools = new AIMessage({ content: '', tool_calls: normalizeToolCalls(toolCalls) });
            logger.info('[llm:followup:start]', {
              toolMessageCount: toolMessages.length,
              totalMessages: modelMessages.length + 1 + toolMessages.length,
            });

            const followupLlm = providerRegistry.getProvider({
              modelIndex: modelIndex, // Use same model index for followup
              streaming: true,
              maxTokens: aiServerConfig.limits.maxOutputTokens,
            });

            const followupStream = await followupLlm.stream([
              ...modelMessages,
              assistantWithTools,
              ...toolMessages
            ]);

            const followupResult = await streamLLMResponse(
              followupStream,
              { parts, isClosed: isAborted, logger },
              'followup'
            );
            followupOutText = followupResult.totalText;

            parts.finishStep();
          }
        }

        // ===== Finish =====
        if (!isAborted()) {
          parts.finish();
          logger.info('[complete]', { 
            provider: aiServerConfig.provider,
            model: useModel || aiServerConfig.getModel(modelIndex),
            mode: mode || 'none',
            durationMs: Date.now() - t0 
          });
        }

      } catch (err: unknown) {
        const msg = getErrorMessage(err);
        logger.error('[error]', { message: msg, stack: getErrorStack(err), provider: aiServerConfig.provider });
        if (!isClosed() && !timedOut) {
          parts.error(msg);
          parts.finish();
        }
      } finally {
        clearTimeout(timeoutId);
        // ===== Quota ACCOUNTING (post-stream) =====
        try {
          if (quotaShouldApply && tokenId) {
            // Input estimate includes system prompt
            const estimatedInput = estimateInputTokensFromModelMessages(
              convertUiToModelMessages(uiMessages, systemPrompt),
              systemPrompt
            );
            // Output estimate from streamed plaintext
            const totalOut = (initialOutText || '') + (followupOutText || '');
            const estimatedOutput = estimateTokensFromText(totalOut);
            const totalUsed = Math.max(0, estimatedInput + estimatedOutput);

            if (totalUsed > 0) {
              await addUsage(tokenId, totalUsed);
              logger.info('[quota] usage recorded', {
                tokenId,
                estimatedInput,
                estimatedOutput,
                totalUsed,
                tookMs: Date.now() - tStart,
              });
            }
          }
        } catch (acctErr: unknown) {
          logger.error('[quota] usage recording failed', { error: getErrorMessage(acctErr) });
        }
      }
    })();

    return response;
  } catch (err: unknown) {
    const msg = getErrorMessage(err);
    logger.error('[fatal]', { message: msg, stack: getErrorStack(err), provider: aiServerConfig.provider });
    return new Response(JSON.stringify({ error: 'Chat request failed', details: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
