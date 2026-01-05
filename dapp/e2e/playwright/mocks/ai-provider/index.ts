// dapp/e2e/playwright/mocks/index.ts

// Main mock
export { installAIMock } from './ai-provider.mock';
export type { AiMockOptions } from './ai-provider.mock';

// MCP caller
export { createMCPCaller } from './mcp-caller';
export type { MCPCaller } from './mcp-caller';

// Response handlers
export {
  composeHandlers,
  helloHandler,
  nftCountHandler,
  musicCommandHandler,
  inlineRendererHandler,
  echoHandler,
  createDefaultHandler,
} from './response-handlers';
export type { ResponseHandler, ResponseContext } from './response-handlers';

// Helpers
export { extractMCPText, extractMCPJson, extractUserMessage } from './helpers';
