// dapp/lib/llm/modes/types.ts
export type ChatMode = 'choose' | 'rapBattle' | 'freestyle' | 'agentBattle';

export interface ModeConfig {
  id: ChatMode;
  title: string;
  description?: string;

  /**
   * Compose the system prompt (mode instructions), optionally enriched with NFT/user context.
   */
  buildPrompt: (nftContext?: string) => string;

  /**
   * Compose the synthetic welcome text shown as an assistant message
   * when this mode is selected (before the user has typed anything).
   * Keep it short and mode-specific.
   */
  buildWelcome: (nftContext?: string) => string;

  /**
   * Available inline rendering tools (client-side).
   * Examples: 'music', 'pageRefresh', 'chainLogo', 'gif', etc.
   */
  availableTools?: string[];

  /**
   * Whitelisted MCP tool names for this mode (server-side filtering).
   * If undefined or empty, all registered tools are available.
   * If defined, only tools in this array will be exposed to the LLM.
   * 
   * Tool names correspond to the `name` field in tool definitions, e.g.:
   * - 'get_eth_balance'
   * - 'generate_rap_verse'
   * - 'send_crypto_to_signed_in_user'
   * 
   * Note: This filtering only affects what tools the main LLM conversation sees.
   * Agent tools executing server-side still have full registry access for internal calls.
   */
  mcpTools?: string[];
}

export interface Fragment {
  id: string;
  content: string;
}