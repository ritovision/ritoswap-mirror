// dapp/e2e/playwright/mocks/mcp-caller.ts
import type { Page } from '@playwright/test';
import { e2eEnv } from '../../env';

export type MCPCaller = (toolName: string, args?: Record<string, unknown>) => Promise<any>;

/**
 * Creates an MCP caller that can make real tool calls from the browser context
 */
export function createMCPCaller(page: Page, debug: boolean): MCPCaller {
  // Pull endpoint from env (defaults to /api/mcp if empty)
  const mcpEndpoint = e2eEnv.mcpEndpoint || '/api/mcp';

  return async (toolName: string, args?: Record<string, unknown>) => {
    if (debug) {
      console.log(`[AI Mock MCP] Calling tool: ${toolName}`, args);
      console.log(`[AI Mock MCP] Endpoint: ${mcpEndpoint}`);
    }

    try {
      // Make real fetch to MCP endpoint with JWT from cookies
      const response = await page.evaluate(
        async ({ tool, toolArgs, endpoint }) => {
          // Get JWT from cookies or localStorage
          let jwt: string | null = null;
          
          // Try cookies first
          const cookies = document.cookie.split(';');
          for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'access_token' || name === 'jwt') {
              jwt = value;
              break;
            }
          }
          
          // Fallback to localStorage
          if (!jwt) {
            jwt = localStorage.getItem('jwt') || localStorage.getItem('access_token');
          }
          
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          
          // Add JWT if available
          if (jwt) {
            headers['Authorization'] = `Bearer ${jwt}`;
          }
          
          const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              method: 'tools/call',
              params: {
                name: tool,
                arguments: toolArgs,
              },
            }),
          });

          const data = await res.json();
          return { ok: res.ok, status: res.status, data };
        },
        { tool: toolName, toolArgs: args || {}, endpoint: mcpEndpoint }
      );

      if (!response.ok) {
        throw new Error(`MCP call failed: ${response.status} - ${JSON.stringify(response.data)}`);
      }

      if (debug) {
        console.log(`[AI Mock MCP] Tool response:`, response.data);
      }

      return response.data;
    } catch (error) {
      // Handle "Test ended" gracefully
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('Test ended') || errorMsg.includes('Target closed')) {
        console.warn(`[AI Mock MCP] Test ended while calling tool ${toolName} - ignoring`);
        throw new Error('Test context closed');
      }
      console.error(`[AI Mock MCP] Tool call failed:`, error);
      throw error;
    }
  };
}
