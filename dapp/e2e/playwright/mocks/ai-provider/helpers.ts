// dapp/e2e/playwright/mocks/helpers.ts

/**
 * Extracts text from MCP tool response
 */
export function extractMCPText(mcpResult: any): string {
  if (!mcpResult?.content) return '';
  
  const textParts = mcpResult.content
    .filter((c: any) => c.type === 'text')
    .map((c: any) => c.text)
    .join('\n');
  
  return textParts;
}

/**
 * Extracts JSON from MCP tool response
 */
export function extractMCPJson(mcpResult: any): any {
  if (!mcpResult?.content) return null;
  
  const jsonPart = mcpResult.content.find((c: any) => c.type === 'json');
  // MCP can return json under either 'json' or 'data' property
  return jsonPart?.json || jsonPart?.data || null;
}

/**
 * Extracts user message from various request body formats
 */
export function extractUserMessage(body: any): string {
  if (!body) return 'unknown';
  
  // Try messages array first (most common)
  if (Array.isArray(body?.messages)) {
    const last = body.messages[body.messages.length - 1];
    
    const rawContent = last?.content ?? last?.parts ?? last?.text;
    
    let content = '';
    if (typeof rawContent === 'string') {
      content = rawContent;
    } else if (Array.isArray(rawContent)) {
      content = rawContent
        .map((c: any) => {
          if (typeof c === 'string') return c;
          if (typeof c?.text === 'string') return c.text;
          if (typeof c?.content === 'string') return c.content;
          return '';
        })
        .join(' ');
    }
    
    if (content) return content;
  }
  
  // Fallback to other formats
  if (typeof body?.prompt === 'string') return body.prompt;
  if (typeof body?.message === 'string') return body.message;
  
  return 'unknown';
}