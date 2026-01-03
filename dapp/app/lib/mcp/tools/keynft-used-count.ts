/*
// dapp/app/lib/mcp/tools/keynft-used-count.ts
*/
import { createLogger } from '@logger';
import type { Tool } from '@schemas/domain/tool';
import { createTool, jsonResult, textResult } from './types';
import { getTokenModel, prisma } from '@lib/prisma/prismaNetworkUtils';
import type { ToolInputMap } from '../generated/tool-catalog-types';

const logger = createLogger('keynft-used-count');

type Params = ToolInputMap['keynft_used_count'];

const InputSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {},
};

type Countable = { count: (args: unknown) => Promise<number> };

const tool: Tool<Params> = {
  name: 'keynft_used_count',
  description: 'Return only the total number of key NFTs marked as used=true for the active chain.',
  requiresJwt: false,
  inputSchema: InputSchema,

  async handler() {
    try {
      const Token = getTokenModel(prisma);
      const total = await (Token as unknown as Countable).count({ where: { used: true } });

      const text = textResult(String(total));
      const json = jsonResult({ total });

      return { content: [...text.content, ...json.content] };
    } catch (err) {
      logger.error('keynft_used_count failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: err instanceof Error ? err.message : 'Failed to compute used key total',
          },
        ],
      };
    }
  },
};

export default createTool(tool);
