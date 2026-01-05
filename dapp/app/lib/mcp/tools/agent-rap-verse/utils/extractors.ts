// dapp/app/lib/mcp/tools/agent-rap-verse/utils/extractors.ts
//
// Extract content from tool call results
//

import type { ToolCallResult, StoreImagePayload } from '../types';

export function extractText(result: ToolCallResult | null): string {
  if (!result?.content) return '';
  return result.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text || '')
    .join('\n');
}

export function extractJson<T = unknown>(result: ToolCallResult | null): T | null {
  if (!result?.content) return null;
  const jsonContent = result.content.find((c) => c.type === 'json');
  return (jsonContent?.data as T) || null;
}

export function extractImagePayloads(result: ToolCallResult | null): StoreImagePayload[] {
  if (!result?.content) return [];
  return result.content
    .filter((c): c is { type: 'json'; data: StoreImagePayload } => 
      c.type === 'json' && 
      typeof c.data === 'object' && 
      c.data !== null &&
      'kind' in c.data && 
      c.data.kind === 'store-image'
    )
    .map((c) => c.data);
}