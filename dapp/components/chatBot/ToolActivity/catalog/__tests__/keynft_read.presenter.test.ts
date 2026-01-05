import { normalizeContent, type Chip } from './presenter-test-utils';

// Valid 40-hex address for contract; short form helper
const VALID_CONTRACT = '0x' + 'abcd'.repeat(10);
const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

async function loadPresenterWithConfig(activeChain: string, localName?: string) {
  vi.resetModules();
  vi.doMock('@/app/config/public.env', () => ({
    publicConfig: { activeChain },
    publicEnv: { NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME: localName },
  }));
  const mod = await import('../presenters/keynft_read.presenter');
  return mod.presenter as any;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('keynft_read.presenter', () => {
  // ---------- pending ----------
  describe('pending()', () => {
    it('get_key_nft_balance shows owner + network', async () => {
      const presenter = await loadPresenterWithConfig('sepolia');
      const owner = '0x1234567890abcdef1234567890abcdef1234ABCD';
      const chip: Chip = { input: { action: 'get_key_nft_balance', owner } };
      const res = normalizeContent(presenter.pending(chip as any));
      expect(res.label).toBe('Checking Key Balance…');
      expect(res.text).toBe(`${short(owner)} on Sepolia`);
    });

    it('get_key_nft_token_metadata shows token id when provided', async () => {
      const presenter = await loadPresenterWithConfig('ritonet', 'RitoNet Dev');
      const chip: Chip = { input: { action: 'get_key_nft_token_metadata', tokenId: '42' } };
      const res = normalizeContent(presenter.pending(chip as any));
      expect(res.label).toBe('Fetching Token Metadata for #42');
      expect(res.text).toBe('');
    });

    it('default action label when unknown', async () => {
      const presenter = await loadPresenterWithConfig('ethereum');
      const chip: Chip = { input: { action: 'unknown' } as any };
      const res = normalizeContent(presenter.pending(chip as any));
      expect(res.label).toBe('Running key_nft_read…');
      expect(res.text).toBe('');
    });
  });

  // ---------- success: get_key_nft_balance ----------
  describe('success() get_key_nft_balance', () => {
    it('formats owner, balance with thousands, network, and contract short addr', async () => {
      const presenter = await loadPresenterWithConfig('sepolia');
      const owner = '0x1234567890abcdef1234567890abcdef1234ABCD';
      const chip: Chip = {
        input: { action: 'get_key_nft_balance' },
        output: {
          content: [
            {
              type: 'json',
              data: {
                balance: 12345, // -> "12,345"
                owner,
                address: VALID_CONTRACT,
                networkName: 'Sepolia',
              },
            },
          ],
        },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Fetched Key Balance.');
      expect(res.text).toBe(`${short(owner)} has 12,345 keys on Sepolia (${short(VALID_CONTRACT)})`);
    });

    it('falls back to text when balance missing', async () => {
      const presenter = await loadPresenterWithConfig('sepolia');
      const chip: Chip = {
        input: { action: 'get_key_nft_balance' },
        output: { content: [{ type: 'text', text: 'No balance available' }] },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.text).toBe('No balance available');
    });
  });

  // ---------- success: get_key_nft_collection_info ----------
  describe('success() get_key_nft_collection_info', () => {
    it('formats name, symbol, network and optional contract', async () => {
      const presenter = await loadPresenterWithConfig('ethereum');
      const chip: Chip = {
        input: { action: 'get_key_nft_collection_info' },
        output: {
          content: [
            { type: 'json', data: { name: 'Key Collection', symbol: 'KEY', address: VALID_CONTRACT } },
          ],
        },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Fetched Collection Info.');
      expect(res.text).toBe(`Key Collection (KEY) on Ethereum — ${short(VALID_CONTRACT)}`);
    });

    it('falls back to text when fields missing', async () => {
      const presenter = await loadPresenterWithConfig('ethereum');
      const chip: Chip = {
        input: { action: 'get_key_nft_collection_info' },
        output: { content: [{ type: 'text', text: 'Partial info' }] },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.text).toBe('Partial info');
    });
  });

  // ---------- success: get_key_nft_total_supply ----------
  describe('success() get_key_nft_total_supply', () => {
    it('shows formatted total supply with network and contract', async () => {
      const presenter = await loadPresenterWithConfig('ritonet', 'RitoNet Dev');
      const chip: Chip = {
        input: { action: 'get_key_nft_total_supply' },
        output: {
          content: [
            { type: 'json', data: { totalSupply: '1000000', address: VALID_CONTRACT } },
          ],
        },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Fetched Key NFT Total Supply.');
      expect(res.text).toBe(`Total supply on RitoNet Dev: 1,000,000 (${short(VALID_CONTRACT)})`);
    });

    it('falls back with unknown when json missing and no text', async () => {
      const presenter = await loadPresenterWithConfig('sepolia');
      const chip: Chip = { input: { action: 'get_key_nft_total_supply' }, output: { content: [] } };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.text).toBe('total supply on Sepolia: (unknown)');
    });
  });

  // ---------- success: get_key_nft_tokens_of_owner ----------
  describe('success() get_key_nft_tokens_of_owner', () => {
    it('lists up to 5 tokens, then "+N more"', async () => {
      const presenter = await loadPresenterWithConfig('sepolia');
      const owner = '0x1234567890abcdef1234567890abcdef1234ABCD';
      const chip: Chip = {
        input: { action: 'get_key_nft_tokens_of_owner' },
        output: {
          content: [
            {
              type: 'json',
              data: {
                owner,
                address: VALID_CONTRACT,
                tokenIds: ['1', '2', '3', '4', '5', '6', '7'],
              },
            },
          ],
        },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Fetched Owner Tokens.');
      expect(res.text).toBe(`${short(owner)} holds 7 tokens on Sepolia (${short(VALID_CONTRACT)}): #1, #2, #3, #4, #5 +2 more`);
    });

    it('shows "none" when empty', async () => {
      const presenter = await loadPresenterWithConfig('ethereum');
      const chip: Chip = {
        input: { action: 'get_key_nft_tokens_of_owner' },
        output: { content: [{ type: 'json', data: { tokenIds: [] } }] },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.text).toBe('Owner holds 0 tokens on Ethereum: none');
    });
  });

  // ---------- success: get_key_nft_token_of_owner ----------
  describe('success() get_key_nft_token_of_owner', () => {
    it('has token with tokenId and network+contract', async () => {
      const presenter = await loadPresenterWithConfig('sepolia');
      const owner = '0x9999999999999999999999999999999999999999';
      const chip: Chip = {
        input: { action: 'get_key_nft_token_of_owner' },
        output: {
          content: [
            {
              type: 'json',
              data: {
                hasToken: true,
                tokenId: '42',
                owner,
                address: VALID_CONTRACT,
              },
            },
          ],
        },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Fetched Key Ownership.');
      expect(res.text).toBe(`${short(owner)} has key #42 on Sepolia (${short(VALID_CONTRACT)})`);
    });

    it('no token case still shows owner/network/contract', async () => {
      const presenter = await loadPresenterWithConfig('ethereum');
      const chip: Chip = {
        input: { action: 'get_key_nft_token_of_owner' },
        output: { content: [{ type: 'json', data: { hasToken: false, address: VALID_CONTRACT } }] },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.text).toBe(`Owner has no key on Ethereum (${short(VALID_CONTRACT)})`);
    });
  });

  // ---------- success: get_key_nft_token_metadata ----------
  describe('success() get_key_nft_token_metadata', () => {
    it('formats properties BG/KeyColor with # and optional contract', async () => {
      const presenter = await loadPresenterWithConfig('ritonet', 'RitoNet Dev');
      const chip: Chip = {
        input: { action: 'get_key_nft_token_metadata' },
        output: {
          content: [
            {
              type: 'json',
              data: {
                tokenId: '77',
                address: VALID_CONTRACT,
                colors: { backgroundColor: '112233', keyColor: '#445566' },
              },
            },
          ],
        },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Fetched Token Metadata.');
      expect(res.text).toBe(`Token #77 on RitoNet Dev — Properties: BG #112233, KeyColor #445566 (${short(VALID_CONTRACT)})`);
    });

    it('handles missing colors gracefully (N/A)', async () => {
      const presenter = await loadPresenterWithConfig('sepolia');
      const chip: Chip = {
        input: { action: 'get_key_nft_token_metadata' },
        output: { content: [{ type: 'json', data: { tokenId: '5' } }] },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.text).toBe('Token #5 on Sepolia — Properties: BG N/A, KeyColor N/A');
    });
  });

  // ---------- success: get_key_nft_holders ----------
  describe('success() get_key_nft_holders', () => {
    it('formats holder count and optional contract', async () => {
      const presenter = await loadPresenterWithConfig('sepolia');
      const chip: Chip = {
        input: { action: 'get_key_nft_holders' },
        output: {
          content: [
            { type: 'json', data: { totalHolders: 1234, address: VALID_CONTRACT } },
          ],
        },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Fetched Key Holders.');
      expect(res.text).toBe(`1,234 holders on Sepolia (${short(VALID_CONTRACT)})`);
    });

    it('falls back to "? holders on <net>" when missing json and no text', async () => {
      const presenter = await loadPresenterWithConfig('ethereum');
      const chip: Chip = { input: { action: 'get_key_nft_holders' }, output: { content: [] } };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.text).toBe('? holders on Ethereum');
    });
  });

  // ---------- success: get_key_nft_summary_for_owner ----------
  describe('success() get_key_nft_summary_for_owner', () => {
    it('summarizes owner count and first token properties on new line', async () => {
      const presenter = await loadPresenterWithConfig('sepolia');
      const owner = '0x1234567890abcdef1234567890abcdef1234ABCD';
      const chip: Chip = {
        input: { action: 'get_key_nft_summary_for_owner' },
        output: {
          content: [
            {
              type: 'json',
              data: {
                owner,
                address: VALID_CONTRACT,
                tokenIds: ['9', '10'],
                tokens: [
                  { tokenId: '9', colors: { backgroundColor: '#aaaaaa', keyColor: 'bbbbbb' } },
                ],
              },
            },
          ],
        },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Fetched Owner Summary.');
      expect(res.text).toBe(
        `${short(owner)} has 2 tokens on Sepolia (${short(VALID_CONTRACT)})\n` +
        'Properties: TokenID #9, BG #aaaaaa, KeyColor #bbbbbb'
      );
    });
  });

  // ---------- success: default action ----------
  describe('success() default action', () => {
    it('returns "Done." with any text content', async () => {
      const presenter = await loadPresenterWithConfig('sepolia');
      const chip: Chip = {
        input: { action: 'something-else' as any },
        output: { content: [{ type: 'text', text: 'basic message' }] },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Done.');
      expect(res.text).toBe('basic message');
    });
  });

  // ---------- error ----------
  describe('error()', () => {
    it('wallet-like errors become friendly', async () => {
      const presenter = await loadPresenterWithConfig('sepolia');
      const chip: Chip = { errorText: 'Wallet must be connected' };
      const res = normalizeContent(presenter.error(chip as any));
      expect(res.label).toBe('key_nft_read failed');
      expect(res.text).toBe('Your wallet must be connected to use this');
    });

    it('falls back to specific or generic error text', async () => {
      const presenter = await loadPresenterWithConfig('ethereum');
      let res = normalizeContent(presenter.error({ errorText: 'Boom' } as any));
      expect(res.text).toBe('Boom');

      res = normalizeContent(presenter.error({} as any));
      expect(res.text).toBe('An unexpected error occurred');
    });
  });
});
