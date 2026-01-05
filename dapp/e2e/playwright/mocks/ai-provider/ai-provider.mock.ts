// dapp/e2e/playwright/mocks/ai-provider.mock.ts
import type { Page } from '@playwright/test';
import { createMCPCaller } from './mcp-caller';
import { extractUserMessage } from './helpers';
import { createDefaultHandler, type ResponseHandler, type ResponseContext } from './response-handlers';
import { e2eEnv } from '../../env';

export interface AiMockOptions {
  routes?: string[];
  handler?: ResponseHandler;
  debug?: boolean;
}

/**
 * SSE mock for chat API with MCP tool calling support.
 * ONLY intercepts /api/chat - nothing else.
 */
export async function installAIMock(page: Page, opts: AiMockOptions = {}) {
  const debug = opts.debug ?? false;
  const handler = opts.handler ?? createDefaultHandler();

  // Read endpoint from env helper (default handled there)
  const mcpEndpoint = e2eEnv.mcpEndpoint || '/api/mcp';

  // Create MCP caller
  const callMCP = createMCPCaller(page, debug);

  // CRITICAL FIX: Use exact URL matching, not glob pattern
  // This prevents accidentally matching other endpoints like /api/gate-access
  await page.route('**/api/**', async (route, request) => {
    const url = request.url();
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const method = request.method();

    // ALLOWLIST: These endpoints must NEVER be intercepted
    const allowedEndpoints = [mcpEndpoint, '/api/gate-access', '/api/token-status'];
    
    // Check if this is an allowed endpoint (exact match or prefix match for dynamic routes)
    const isAllowed = allowedEndpoints.some(allowed => 
      pathname === allowed || pathname.startsWith(allowed + '/')
    );
    
    if (isAllowed) {
      // Silently pass through - don't even log
      return route.fallback();
    }

    // IMMEDIATE CHECK: Only handle /api/chat, nothing else
    if (pathname !== '/api/chat') {
      if (debug && pathname.startsWith('/api/')) {
        console.log(`[AI Mock] Ignoring ${method} ${pathname} (not /api/chat)`);
      }
      return route.fallback();
    }

    // Only intercept POST requests to /api/chat
    if (method !== 'POST') {
      if (debug) console.log(`[AI Mock] Passing through ${method} /api/chat (not POST)`);
      return route.fallback();
    }

    if (debug) {
      console.log(`[AI Mock] ✓ Intercepting POST ${pathname}`);
    }

    // Now it's safe to read the body
    let body: any = null;
    try {
      const raw = request.postData() || '';
      body = raw ? JSON.parse(raw) : null;
      if (debug) {
        console.log(`[AI Mock] Chat request:`, {
          messageCount: body?.messages?.length,
          lastMessage: body?.messages?.[body.messages.length - 1],
        });
      }
    } catch (e) {
      console.error('[AI Mock] Failed to parse chat request body:', e);
      return route.fulfill({
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
      });
    }

    // Extract user message
    const userMessage = extractUserMessage(body);

    if (debug) {
      console.log(`[AI Mock] User message: "${userMessage}"`);
    }

    // Build response context
    const ctx: ResponseContext = {
      userMessage,
      url,
      body,
      callMCP,
    };

    // Generate response using handler
    const reply = await handler(ctx);

    if (debug) {
      console.log(`[AI Mock] Mock reply: "${reply}"`);
    }

    // Build SSE stream
    const messageId = `msg_mock_${Math.random().toString(36).slice(2)}`;
    const textId = `txt_mock_${Math.random().toString(36).slice(2)}`;

    let s = '';
    s += `data: ${JSON.stringify({ type: 'start', messageId })}\n\n`;
    s += `data: ${JSON.stringify({ type: 'start-step' })}\n\n`;
    s += `data: ${JSON.stringify({ type: 'text-start', id: textId })}\n\n`;
    s += `data: ${JSON.stringify({ type: 'text-delta', id: textId, delta: reply })}\n\n`;
    s += `data: ${JSON.stringify({ type: 'text-end', id: textId })}\n\n`;
    s += `data: ${JSON.stringify({ type: 'finish-step' })}\n\n`;
    s += `data: ${JSON.stringify({ type: 'finish' })}\n\n`;
    s += `data: [DONE]\n\n`;

    if (debug) {
      console.log(`[AI Mock] Sending SSE response (${s.length} bytes)`);
    }

    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'x-vercel-ai-ui-message-stream': 'v1',
      },
      body: s,
    });

    if (debug) {
      console.log(`[AI Mock] Response sent successfully`);
    }
  });

  if (debug) {
    console.log(`[AI Mock] Installed route interceptor for /api/chat only (MCP allowlist: ${mcpEndpoint})`);
  }
}
