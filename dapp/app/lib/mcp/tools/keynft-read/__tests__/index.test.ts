// dapp/app/lib/mcp/tools/keynft-read/__tests__/index.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

// ---- Hoisted global mocks (applied before SUT is loaded) ----
vi.mock('@logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@config/public.env', () => ({
  publicConfig: { activeChain: 'sepolia' },
  publicEnv: { NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME: 'RitoLocal' },
}));

vi.mock('@config/contracts', () => ({
  KEY_TOKEN_ADDRESS: '0x2222222222222222222222222222222222222222',
  fullKeyTokenAbi: [],
  onePerWalletAbi: [],
}));

// Mock each action module; hoisted so they intercept eager imports.
vi.mock('../actions/collection-info', () => ({ handleCollectionInfo: vi.fn() }));
vi.mock('../actions/total-supply', () => ({ handleTotalSupply: vi.fn() }));
vi.mock('../actions/balance', () => ({ handleBalance: vi.fn() }));
vi.mock('../actions/owner-tokens', () => ({ handleOwnerTokens: vi.fn() }));
vi.mock('../actions/owner-single', () => ({ handleOwnerSingle: vi.fn() }));
vi.mock('../actions/token-metadata', () => ({ handleTokenMetadata: vi.fn() }));
vi.mock('../actions/holders', () => ({ handleHolders: vi.fn() }));
vi.mock('../actions/owner-summary', () => ({ handleOwnerSummary: vi.fn() }));

describe('key_nft_read tool (index dispatcher)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // NOTE: don't call vi.resetModules() or you'll drop hoisted mocks.
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('routes to get_key_nft_collection_info handler', async () => {
    const mockResult = { content: [{ type: 'text', text: 'collection info' }] };
    const { handleCollectionInfo } = await import('../actions/collection-info');
    (handleCollectionInfo as unknown as Mock).mockResolvedValue(mockResult);

    const toolDef = await import('../index').then(m => m.default);
    const res = await toolDef.handler({ action: 'get_key_nft_collection_info' });
    expect(res).toEqual(mockResult);
  });

  it('routes to get_key_nft_total_supply handler', async () => {
    const mockResult = { content: [{ type: 'text', text: 'total supply' }] };
    const { handleTotalSupply } = await import('../actions/total-supply');
    (handleTotalSupply as unknown as Mock).mockResolvedValue(mockResult);

    const toolDef = await import('../index').then(m => m.default);
    const res = await toolDef.handler({ action: 'get_key_nft_total_supply' });
    expect(res).toEqual(mockResult);
  });

  it('routes to get_key_nft_balance handler', async () => {
    const mockResult = { content: [{ type: 'text', text: 'balance ok' }] };
    const { handleBalance } = await import('../actions/balance');
    (handleBalance as unknown as Mock).mockResolvedValue(mockResult);

    const toolDef = await import('../index').then(m => m.default);
    const res = await toolDef.handler({
      action: 'get_key_nft_balance',
      owner: '0x1111111111111111111111111111111111111111',
    });
    expect(res).toEqual(mockResult);
  });

  it('routes to get_key_nft_tokens_of_owner handler', async () => {
    const mockResult = { content: [{ type: 'text', text: 'owner tokens' }] };
    const { handleOwnerTokens } = await import('../actions/owner-tokens');
    (handleOwnerTokens as unknown as Mock).mockResolvedValue(mockResult);

    const toolDef = await import('../index').then(m => m.default);
    const res = await toolDef.handler({
      action: 'get_key_nft_tokens_of_owner',
      owner: '0x1111111111111111111111111111111111111111',
    });
    expect(res).toEqual(mockResult);
  });

  it('routes to get_key_nft_token_of_owner handler', async () => {
    const mockResult = { content: [{ type: 'text', text: 'owner single' }] };
    const { handleOwnerSingle } = await import('../actions/owner-single');
    (handleOwnerSingle as unknown as Mock).mockResolvedValue(mockResult);

    const toolDef = await import('../index').then(m => m.default);
    const res = await toolDef.handler({
      action: 'get_key_nft_token_of_owner',
      owner: '0x1111111111111111111111111111111111111111',
    });
    expect(res).toEqual(mockResult);
  });

  it('routes to get_key_nft_token_metadata handler', async () => {
    const mockResult = { content: [{ type: 'text', text: 'token metadata' }] };
    const { handleTokenMetadata } = await import('../actions/token-metadata');
    (handleTokenMetadata as unknown as Mock).mockResolvedValue(mockResult);

    const toolDef = await import('../index').then(m => m.default);
    const res = await toolDef.handler({
      action: 'get_key_nft_token_metadata',
      tokenId: '123',
    });
    expect(res).toEqual(mockResult);
  });

  it('routes to get_key_nft_holders handler', async () => {
    const mockResult = { content: [{ type: 'text', text: 'holders' }] };
    const { handleHolders } = await import('../actions/holders');
    (handleHolders as unknown as Mock).mockResolvedValue(mockResult);

    const toolDef = await import('../index').then(m => m.default);
    const res = await toolDef.handler({
      action: 'get_key_nft_holders',
      maxTokens: 10,
    });
    expect(res).toEqual(mockResult);
  });

  it('routes to get_key_nft_summary_for_owner handler', async () => {
    const mockResult = { content: [{ type: 'text', text: 'owner summary' }] };
    const { handleOwnerSummary } = await import('../actions/owner-summary');
    (handleOwnerSummary as unknown as Mock).mockResolvedValue(mockResult);

    const toolDef = await import('../index').then(m => m.default);
    const res = await toolDef.handler({
      action: 'get_key_nft_summary_for_owner',
      owner: '0x1111111111111111111111111111111111111111',
    });
    expect(res).toEqual(mockResult);
  });

  it('throws for unknown action', async () => {
    const toolDef = await import('../index').then(m => m.default);
    await expect(toolDef.handler({ action: 'no_such_action' } as any)).rejects.toThrow(/Unknown action/i);
  });
});
