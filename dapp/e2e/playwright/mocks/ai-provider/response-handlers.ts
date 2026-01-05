// dapp/e2e/playwright/mocks/response-handlers.ts
import type { MCPCaller } from './mcp-caller';
import { extractMCPJson } from './helpers';

/**
 * Response handler context
 */
export interface ResponseContext {
  userMessage: string;
  url: string;
  body: any;
  callMCP: MCPCaller;
}

/**
 * Response handler function
 */
export type ResponseHandler = (ctx: ResponseContext) => Promise<string | null> | string | null;

/**
 * Compose multiple handlers - first one that returns non-null wins
 */
export function composeHandlers(...handlers: ResponseHandler[]): ResponseHandler {
  return async (ctx: ResponseContext) => {
    for (const handler of handlers) {
      const result = await handler(ctx);
      if (result !== null) return result;
    }
    return null;
  };
}

// ============================================================================
// BUILT-IN HANDLERS
// ============================================================================

/**
 * Handler: Simple hello response
 */
export function helloHandler(): ResponseHandler {
  return (ctx) => {
    if (ctx.userMessage.toLowerCase().includes('hello')) {
      return 'Hello back!';
    }
    return null;
  };
}

/**
 * Handler: NFT count via MCP tool
 */
export function nftCountHandler(): ResponseHandler {
  return async (ctx) => {
    const msg = ctx.userMessage.toLowerCase();
    if (!msg.includes('how many nft') && !msg.includes('nft count') && !msg.includes('total supply')) {
      return null;
    }

    try {
      const result = await ctx.callMCP('key_nft_read', {
        action: 'get_key_nft_total_supply',
      });

      if (!result?.content) {
        console.warn('[NFT Count Handler] Invalid MCP response: missing content');
        return 'Sorry, the MCP tool did not return valid data.';
      }

      const json = extractMCPJson(result);
      if (!json?.totalSupply) {
        console.warn('[NFT Count Handler] Invalid MCP response:', {
          hasContent: !!result.content,
          contentTypes: result.content.map((c: any) => c.type),
          json,
        });
        return 'Sorry, the MCP tool did not return NFT count.';
      }

      const count = json.totalSupply;
      console.log(`[NFT Count Handler] ✅ Got total supply: ${count}`);

      return `There are ${count} NFTs in the collection.`;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[NFT Count Handler] MCP call failed:', errorMsg);

      if (errorMsg.includes('Test context closed') || errorMsg.includes('Test ended')) {
        return 'MCP call interrupted (test ending).';
      }

      return `Error calling MCP: ${errorMsg}`;
    }
  };
}

/**
 * Handler: Music player commands
 * Responds with renderer commands like <music song="..." />
 */
export function musicCommandHandler(): ResponseHandler {
  return (ctx) => {
    const msg = ctx.userMessage.toLowerCase();
    
    const songMap: Record<string, string> = {
      'altcoin love': 'Altcoin_Love',
      'play altcoin love': 'Altcoin_Love',
      'altcoin': 'Altcoin_Love',
    };

    for (const [trigger, songName] of Object.entries(songMap)) {
      if (msg.includes(trigger)) {
        console.log(`[Music Handler] Playing: ${songName}`);
        return `<music song="${songName}" />`;
      }
    }

    return null;
  };
}

/**
 * Handler: Inline renderers (KeyNFT, Chain Logo, GIF, Image)
 * Returns inline tags that the UI will render (not literal text).
 */
export function inlineRendererHandler(): ResponseHandler {
  return (ctx) => {
    const msg = ctx.userMessage.toLowerCase().trim();

    const entries: Array<{ match: (m: string) => boolean; reply: string }> = [
      {
        match: (m) =>
          m.includes('keynft') ||
          m.includes('render key') ||
          m.includes('show key') ||
          m.includes('draw key'),
        reply: `<key-nft />`,
      },
      {
        match: (m) => m.includes('ethereum logo') || m.includes('eth logo'),
        reply: `<chain-logo name="Ethereum" width="128" />`,
      },
      {
        match: (m) => m.includes('bitcoin logo') || m.includes('btc logo'),
        reply: `<chain-logo name="Bitcoin" width="128" />`,
      },
      {
        match: (m) =>
          m.includes('celebratory gif') ||
          m.includes('party gif') ||
          m.includes('send gif') ||
          m.includes('show gif') ||
          m.includes('gif please'),
        reply: `<gif src="https://media1.tenor.com/m/a5BfMS5dzHkAAAAd/you.gif" width="320" alt="funny GIF" />`,
      },
      {
        match: (m) =>
          m.includes('rito logo') ||
          m.includes('ritoswap logo') ||
          m.includes('show image rito') ||
          m.includes('show image ritoswap') ||
          m.includes('show ritoswap image') ||
          m.includes('show rito image'),
        reply: `<img src="https://ritoswap.com/_next/image?url=%2Fimages%2Fbrand%2Fritoswap.png&w=384&q=75" alt="RitoSwap logo" width="400" height="300" />`,
      },
    ];

    for (const e of entries) {
      if (e.match(msg)) {
        console.log(`[Inline Renderer Handler] Triggered -> ${e.reply}`);
        return e.reply;
      }
    }
    return null;
  };
}

/**
 * Handler: Echo fallback (echoes user input)
 */
export function echoHandler(): ResponseHandler {
  return (ctx) => {
    return `You said: ${ctx.userMessage}`;
  };
}

/**
 * Creates the default handler composition
 */
export function createDefaultHandler(): ResponseHandler {
  return composeHandlers(
    helloHandler(),
    nftCountHandler(),
    musicCommandHandler(),
    inlineRendererHandler(),
    echoHandler()
  );
}
