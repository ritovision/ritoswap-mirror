import { presenter } from '../presenters/eth_balance.presenter';

// Normalize ToolChipContent (string | {label?, text?}) to an object
function normalizeContent(c: unknown): { label?: string; text?: string } {
  if (typeof c === 'string') return { label: '', text: c };
  if (c && typeof c === 'object') {
    const obj = c as { label?: string; text?: string };
    return { label: obj.label, text: obj.text };
  }
  return { label: '', text: '' };
}

type Chip = {
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

describe('get_eth_balance.presenter', () => {
  describe('pending()', () => {
    it('returns label-only pending with empty text (with chain present)', () => {
      const chip: Chip = { input: { chain: 'sepolia' } };
      const res = normalizeContent(presenter.pending(chip as any));
      expect(res.label).toBe('Fetching Balance');
      expect(res.text).toBe('');
    });

    it('returns label-only pending with empty text (no input)', () => {
      const res = normalizeContent(presenter.pending({} as any));
      expect(res.label).toBe('Fetching Balance');
      expect(res.text).toBe('');
    });
  });

  describe('success()', () => {
    it('formats amount, symbol, and chainName when provided', () => {
      const chip: Chip = {
        output: {
          content: [
            {
              type: 'json',
              data: {
                symbol: 'ETH',
                balanceEth: '1.2345',
                chainName: 'Sepolia',
              },
            },
          ],
        },
      };

      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Fetched Balance.');
      expect(res.text).toBe('1.2345 ETH on Sepolia');
    });

    it('falls back to "chain" field when chainName is missing', () => {
      const chip: Chip = {
        output: {
          content: [
            {
              type: 'json',
              data: {
                symbol: 'ETH',
                balanceEth: '0.01',
                chain: 'ethereum',
              },
            },
          ],
        },
      };

      const res = normalizeContent(presenter.success(chip as any));
      expect(res.text).toBe('0.01 ETH on ethereum');
    });

    it('defaults to "mainnet" when no chain info is present', () => {
      const chip: Chip = {
        output: {
          content: [
            { type: 'json', data: { balanceEth: '3.0' } }, // symbol defaults to ETH
          ],
        },
      };

      const res = normalizeContent(presenter.success(chip as any));
      expect(res.text).toBe('3.0 ETH on mainnet');
    });

    it('falls back to joined text content when no json', () => {
      const chip: Chip = {
        output: {
          content: [
            { type: 'text', text: '   line one   ' },
            { type: 'text', text: 'line two' },
          ],
        },
      };

      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Fetched Balance.');
      expect(res.text).toBe('line one\nline two');
    });

    it('returns empty text when balanceEth is not a string even if JSON exists', () => {
      const chip: Chip = {
        output: {
          content: [
            {
              type: 'json',
              data: { balanceEth: 123.45, chainName: 'Sepolia' }, // non-string amount
            },
          ],
        },
      };

      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Fetched Balance.');
      expect(res.text).toBe('');
    });
  });

  describe('error()', () => {
    it('maps wallet-like errors to friendly message', () => {
      const chip: Chip = { errorText: 'Wallet not connected' };
      const res = normalizeContent(presenter.error(chip as any));
      expect(res.label).toBe('Failed to Fetch Balance.');
      expect(res.text).toBe('Your wallet must be connected to use this');
    });

    it('passes through specific error text when not wallet-related', () => {
      const chip: Chip = { errorText: 'Rate limit exceeded' };
      const res = normalizeContent(presenter.error(chip as any));
      expect(res.text).toBe('Rate limit exceeded');
    });

    it('defaults to generic message when no errorText', () => {
      const res = normalizeContent(presenter.error({} as any));
      expect(res.text).toBe('An unexpected error occurred');
    });
  });
});
