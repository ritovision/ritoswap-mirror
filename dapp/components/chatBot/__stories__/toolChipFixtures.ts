import type { ToolCallChipData } from '../ToolActivity/ToolCallChip';

const CREATED_AT = 1700000000000;

function baseChip(toolName: string, toolCallId: string): ToolCallChipData {
  return {
    toolCallId,
    toolName,
    status: 'pending',
    createdAt: CREATED_AT,
  };
}

type ToolChipFixtureSet = {
  pending: ToolCallChipData;
  success: ToolCallChipData;
  error: ToolCallChipData;
};

export const toolChipFixtures: Record<string, ToolChipFixtureSet> = {
  getEthBalance: {
    pending: {
      ...baseChip('get_eth_balance', 'chip-get-eth-balance'),
      input: { chain: 'mainnet' },
    },
    success: {
      ...baseChip('get_eth_balance', 'chip-get-eth-balance'),
      status: 'success',
      input: { chain: 'mainnet' },
      output: { content: [{ type: 'json', data: { balanceEth: '1.2389', symbol: 'ETH', chainName: 'Ethereum' } }] },
    },
    error: {
      ...baseChip('get_eth_balance', 'chip-get-eth-balance'),
      status: 'error',
      errorText: 'Wallet not connected',
    },
  },
  generateRapVerse: {
    pending: {
      ...baseChip('generate_rap_verse', 'chip-generate-rap-verse'),
      input: { roundNumber: 2 },
    },
    success: {
      ...baseChip('generate_rap_verse', 'chip-generate-rap-verse'),
      status: 'success',
      input: { roundNumber: 2 },
      output: { content: [{ type: 'json', data: { round: 2 } }] },
    },
    error: {
      ...baseChip('generate_rap_verse', 'chip-generate-rap-verse'),
      status: 'error',
      errorText: 'Agent choked on the mic',
    },
  },
  generateImage: {
    pending: {
      ...baseChip('generate_image_with_alt', 'chip-generate-image'),
      input: { prompt: 'Rito in neon city' },
    },
    success: {
      ...baseChip('generate_image_with_alt', 'chip-generate-image'),
      status: 'success',
      input: { prompt: 'Rito in neon city' },
      output: {
        content: [
          {
            type: 'json',
            data: {
              kind: 'store-image',
              name: 'storybook-rito',
              mime: 'image/png',
              width: 256,
              height: 256,
              alt: 'Rito concept art',
              dataBase64:
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/Pq5G2QAAAABJRU5ErkJggg==',
            },
          },
        ],
      },
    },
    error: {
      ...baseChip('generate_image_with_alt', 'chip-generate-image'),
      status: 'error',
      errorText: 'Render failed',
    },
  },
  keyNftRead: {
    pending: {
      ...baseChip('key_nft_read', 'chip-key-nft-read'),
      input: { action: 'get_key_nft_summary_for_owner' },
    },
    success: {
      ...baseChip('key_nft_read', 'chip-key-nft-read'),
      status: 'success',
      input: { action: 'get_key_nft_summary_for_owner' },
      output: {
        content: [
          {
            type: 'json',
            data: {
              action: 'get_key_nft_summary_for_owner',
              owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
              address: '0x1234567890abcdef1234567890abcdef12345678',
              tokenIds: ['101', '202'],
              tokens: [
                {
                  tokenId: '101',
                  colors: { backgroundColor: '#0d1117', keyColor: '#f97316' },
                },
              ],
            },
          },
        ],
      },
    },
    error: {
      ...baseChip('key_nft_read', 'chip-key-nft-read'),
      status: 'error',
      errorText: 'Your wallet must be connected to use this',
    },
  },
  keyNftManage: {
    pending: {
      ...baseChip('manage_key_nft', 'chip-key-nft-manage'),
      input: { action: 'mint' },
    },
    success: {
      ...baseChip('manage_key_nft', 'chip-key-nft-manage'),
      status: 'success',
      input: { action: 'mint' },
      output: {
        content: [
          {
            type: 'json',
            data: {
              action: 'mint',
              tokenId: '404',
              burnedTokenId: '222',
              colors: { backgroundColor: '#0b1b2b', keyColor: '#22d3ee' },
              timeline: [
                { phase: 'burn', message: 'Burned previous key' },
                { phase: 'mint', message: 'Minted new key' },
                { phase: 'result', message: 'Key ready' },
              ],
            },
          },
        ],
      },
    },
    error: {
      ...baseChip('manage_key_nft', 'chip-key-nft-manage'),
      status: 'error',
      errorText: 'Key NFT action failed',
    },
  },
  keyNftUsedCount: {
    pending: {
      ...baseChip('keynft_used_count', 'chip-key-nft-used'),
    },
    success: {
      ...baseChip('keynft_used_count', 'chip-key-nft-used'),
      status: 'success',
      output: { content: [{ type: 'json', data: { total: 57 } }] },
    },
    error: {
      ...baseChip('keynft_used_count', 'chip-key-nft-used'),
      status: 'error',
      errorText: 'Failed to count used keys',
    },
  },
  markKeyUsed: {
    pending: {
      ...baseChip('mark_key_used', 'chip-mark-key-used'),
      input: { tokenId: 777 },
    },
    success: {
      ...baseChip('mark_key_used', 'chip-mark-key-used'),
      status: 'success',
      input: { tokenId: 777 },
      output: {
        content: [
          {
            type: 'json',
            data: {
              tokenId: 777,
              chainName: 'RitoNet',
              address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
              usedAt: '2024-01-30T20:01:02.000Z',
            },
          },
        ],
      },
    },
    error: {
      ...baseChip('mark_key_used', 'chip-mark-key-used'),
      status: 'error',
      errorText: 'Failed to mark key as used',
    },
  },
  pineconeSearch: {
    pending: {
      ...baseChip('pinecone_search', 'chip-pinecone-search'),
      input: { query: 'rap battle training data', index: 'rito-knowledge', namespace: 'rapbot' },
    },
    success: {
      ...baseChip('pinecone_search', 'chip-pinecone-search'),
      status: 'success',
      input: { query: 'rap battle training data', index: 'rito-knowledge', namespace: 'rapbot' },
      output: {
        content: [
          {
            type: 'json',
            data: {
              query: 'rap battle training data',
              index: 'rito-knowledge',
              namespace: 'rapbot',
              totalMatches: 12,
              topK: 5,
              matches: [{ score: 0.932, metadata: { title: 'Rito battle guide' } }],
            },
          },
        ],
      },
    },
    error: {
      ...baseChip('pinecone_search', 'chip-pinecone-search'),
      status: 'error',
      errorText: 'Index "rito-knowledge" not found',
    },
  },
  sendCrypto: {
    pending: {
      ...baseChip('send_crypto_to_signed_in_user', 'chip-send-crypto'),
      input: { amountEth: 0.42 },
    },
    success: {
      ...baseChip('send_crypto_to_signed_in_user', 'chip-send-crypto'),
      status: 'success',
      input: { amountEth: 0.42 },
      output: {
        content: [
          {
            type: 'json',
            data: {
              amountEth: 0.42,
              to: '0x7F5f4552091A69125d5DfCb7b8C2659029395Bdf',
              networkName: 'Ethereum',
            },
          },
        ],
      },
    },
    error: {
      ...baseChip('send_crypto_to_signed_in_user', 'chip-send-crypto'),
      status: 'error',
      errorText: 'Your wallet must be connected to use this',
    },
  },
  sendCryptoAgent: {
    pending: {
      ...baseChip('send_crypto_agent', 'chip-send-crypto-agent'),
      input: { amountEth: 0.09 },
    },
    success: {
      ...baseChip('send_crypto_agent', 'chip-send-crypto-agent'),
      status: 'success',
      input: { amountEth: 0.09 },
      output: {
        content: [
          {
            type: 'json',
            data: {
              decision: 'send',
              sentAmountEth: 0.09,
              to: '0x123400000000000000000000000000000000cafe',
              chainName: 'Base',
            },
          },
        ],
      },
    },
    error: {
      ...baseChip('send_crypto_agent', 'chip-send-crypto-agent'),
      status: 'error',
      errorText: 'Agent declined',
    },
  },
};
