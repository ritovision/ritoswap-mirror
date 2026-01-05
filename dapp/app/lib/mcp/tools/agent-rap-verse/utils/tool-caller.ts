// dapp/app/lib/mcp/tools/agent-rap-verse/utils/tool-caller.ts
//
// Tool registry interaction utilities
//

import { createLogger } from '@logger';
import { toolRegistry } from '../../index';
import type { ToolCallResult } from '../types';

const logger = createLogger('agent-tool-caller');

export async function callRegistryTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolCallResult | null> {
  const toolDef = toolRegistry.get(toolName);
  if (!toolDef) {
    logger.warn(`Tool not found in registry: ${toolName}`);
    return null;
  }

  try {
    const result = await toolDef.handler(args);
    return result as ToolCallResult;
  } catch (err) {
    const error = err as Error;
    logger.error(`Tool call failed: ${toolName}`, { error: error.message });
    return null;
  }
}