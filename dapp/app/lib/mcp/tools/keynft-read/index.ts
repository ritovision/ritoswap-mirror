// dapp/app/lib/mcp/tools/keynft-read/index.ts
import type { Tool } from '@schemas/domain/tool';                 
import { createTool /*, jsonResult, errorResult, textResult */ } from '../types';
import { fail } from '../tool-errors';

import { handleCollectionInfo } from './actions/collection-info';
import { handleTotalSupply } from './actions/total-supply';
import { handleBalance } from './actions/balance';
import { handleOwnerTokens } from './actions/owner-tokens';
import { handleOwnerSingle } from './actions/owner-single';
import { handleTokenMetadata } from './actions/token-metadata';
import { handleHolders } from './actions/holders';
import { handleOwnerSummary } from './actions/owner-summary';

type Actions =
  | 'get_key_nft_collection_info'
  | 'get_key_nft_total_supply'
  | 'get_key_nft_balance'
  | 'get_key_nft_tokens_of_owner'
  | 'get_key_nft_token_of_owner'
  | 'get_key_nft_token_metadata'
  | 'get_key_nft_holders'
  | 'get_key_nft_summary_for_owner';

type Params = {
  action: Actions;
  owner?: string;
  tokenId?: string;
  includeColors?: boolean;
  includeURI?: boolean;
  maxTokens?: number | string;
  startIndex?: number | string;
  concurrency?: number;
};

const InputSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    action: {
      type: 'string',
      enum: [
        'get_key_nft_collection_info',
        'get_key_nft_total_supply',
        'get_key_nft_balance',
        'get_key_nft_tokens_of_owner',
        'get_key_nft_token_of_owner',
        'get_key_nft_token_metadata',
        'get_key_nft_holders',
        'get_key_nft_summary_for_owner',
      ],
    },
    owner: {
      type: 'string',
      description: 'Owner address (0x...)',
      pattern: '^0x[a-fA-F0-9]{40}$',
    },
    tokenId: { type: 'string', pattern: '^[0-9]+$' },
    includeColors: { type: 'boolean', default: true },
    includeURI: { type: 'boolean', default: true },
    maxTokens: {
      anyOf: [{ type: 'integer', minimum: 1 }, { type: 'string', pattern: '^\\d+$' }],
    },
    startIndex: {
      anyOf: [{ type: 'string', pattern: '^\\d+$' }, { type: 'integer', minimum: 0 }],
      default: '0',
    },
    concurrency: { type: 'integer', minimum: 1, maximum: 200, default: 25 },
  },
  required: ['action'],
};

export const tool: Tool<Params> = {
  name: 'key_nft_read',
  description:
    'Consolidated Key NFT read functions. Pass `action` plus the same inputs the original tools accepted.',
  inputSchema: InputSchema,
  async handler(input: Params) {                                 
    switch (input.action) {
      case 'get_key_nft_collection_info':
        return handleCollectionInfo();
      case 'get_key_nft_total_supply':
        return handleTotalSupply();
      case 'get_key_nft_balance':
        return handleBalance(input);
      case 'get_key_nft_tokens_of_owner':
        return handleOwnerTokens(input);
      case 'get_key_nft_token_of_owner':
        return handleOwnerSingle(input);
      case 'get_key_nft_token_metadata':
        return handleTokenMetadata(input);
      case 'get_key_nft_holders':
        return handleHolders(input);
      case 'get_key_nft_summary_for_owner':
        return handleOwnerSummary(input);
      default:
        fail('Unknown action for key_nft_read');
    }
  },
};

export default createTool(tool);
