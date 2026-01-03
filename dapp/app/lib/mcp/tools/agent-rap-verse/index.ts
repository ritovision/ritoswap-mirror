// dapp/app/lib/mcp/tools/agent-rap-verse/index.ts
//
// Main entry point - exports the MCP tool
//

import { createLogger } from '@logger';
import type { Tool } from '../../../../schemas/domain/tool';
import { createTool, textResult, jsonResult } from '../types';
import { errorResultShape } from '../tool-errors';
import type { AgentParams } from './types';
import { runAgent } from './orchestrator';

const logger = createLogger('agent-rap-verse');

// ============================================================================
// INPUT SCHEMA
// ============================================================================

const InputSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    chatHistory: {
      type: 'array',
      description: 'Recent chat messages for context',
      items: { type: 'object' },
    },
    userContext: {
      type: 'object',
      description: 'User wallet and NFT context',
      properties: {
        address: { type: 'string' },
        hasNFT: { type: 'boolean' },
        tokenId: { type: 'string' },
        backgroundColor: { type: 'string' },
        keyColor: { type: 'string' },
      },
    },
    roundNumber: {
      type: 'integer',
      description: 'Current battle round (1-3)',
      minimum: 1,
      maximum: 3,
    },
  },
  required: [],
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

const tool: Tool<AgentParams> = {
  name: 'generate_rap_verse',
  description:
    'AI agent that strategically plans battle approach, dynamically gathers resources (memes, Rito pics, fire lyrics, wallet data), composes original verses with variety, and self-reviews quality. Makes independent decisions about tool usage and content creation.',
  inputSchema: InputSchema,

  async handler(params: AgentParams) {
    try {
      logger.info('[Handler] Agent invoked', {
        round: params.roundNumber,
        hasContext: Boolean(params.userContext),
        historyLength: params.chatHistory?.length || 0,
      });

      // Run the agent
      const output = await runAgent(params);

      // Prepare response content
      const text = textResult(output.verse);
      const json = jsonResult({
        verse: output.verse,
        round: params.roundNumber || 1,
        strategy: {
          theme: output.metadata.strategy.theme,
          tone: output.metadata.strategy.tone,
          visualApproach: output.metadata.strategy.visualApproach,
        },
        resourcesUsed: output.metadata.resourcesUsed,
        refinementCount: output.metadata.refinementCount,
        review: {
          isReadyToShip: output.metadata.reviewResults.isReadyToShip,
          strengths: output.metadata.reviewResults.strengths,
          weaknesses: output.metadata.reviewResults.weaknesses,
        },
        generatedAt: output.metadata.generatedAt,
      });

      // Forward image payloads for SSE (critical for base64 handling)
      const imageJsonParts = output.imagePayloads.map((payload) => ({
        type: 'json' as const,
        data: payload,
      }));

      logger.info('[Handler] Returning content', {
        textParts: text.content.length,
        jsonParts: json.content.length,
        imageParts: imageJsonParts.length,
        versePreview: output.verse.slice(0, 120),
        resourcesUsed: output.metadata.resourcesUsed,
      });

      return {
        content: [...text.content, ...json.content, ...imageJsonParts],
      };
    } catch (err) {
      const error = err as Error;
      const msg = error.message || String(err);
      logger.error('[Handler] Agent failed', { error: msg, stack: error.stack });
      return errorResultShape(`Failed to generate rap verse: ${msg}`);
    }
  },
};

export default createTool(tool);