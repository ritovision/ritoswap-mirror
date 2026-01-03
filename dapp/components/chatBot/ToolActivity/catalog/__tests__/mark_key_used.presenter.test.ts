import { normalizeContent, type Chip } from './presenter-test-utils';

async function loadPresenterWithConfig(activeChain: string, localName?: string) {
  vi.resetModules();
  vi.doMock('@/app/config/public.env', () => {
    return {
      publicConfig: { activeChain },
      publicEnv: { NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME: localName },
    };
  });

  const mod = await import('../presenters/mark_key_used.presenter');
  return mod.presenter as any;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('mark_key_used.presenter', () => {
  describe('pending()', () => {
    it('returns label-only pending with empty text', async () => {
      const presenter = await loadPresenterWithConfig('sepolia');
      const res = normalizeContent(presenter.pending({} as any));
      expect(res.label).toBe('Marking Key as Used');
      expect(res.text).toBe('');
    });
  });

  describe('success()', () => {
    it('formats with fallback chain (sepolia), short address, and formatted usedAt', async () => {
      const presenter = await loadPresenterWithConfig('sepolia');

      const addr = '0x1234567890abcdef1234567890abcdef1234ABCD'; // valid 0x + 40 hex
      const iso = '2024-05-01T12:34:56Z';

      const chip: Chip = {
        output: {
          content: [
            {
              type: 'json',
              data: {
                tokenId: 123,
                // chainName omitted -> uses activeNetworkName() => "Sepolia"
                address: addr,
                usedAt: iso,
              },
            },
          ],
        },
      };

      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Marked Key as Used.');
      // shortAddr: first 6 + ellipsis + last 4
      expect(res.text).toContain('Key #123 on Sepolia by 0x1234…ABCD');
      // date/time pattern "MM/DD/YYYY HH:MM:SS"
      expect(res.text).toMatch(/\b\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}:\d{2}\b/);
      expect(res.text).toContain(' at ');
    });

    it('uses provided chainName from JSON when present', async () => {
      const presenter = await loadPresenterWithConfig('ethereum');
      const chip: Chip = {
        output: {
          content: [
            {
              type: 'json',
              data: {
                tokenId: 7,
                chainName: 'MyChain',
                // no address, no usedAt
              },
            },
          ],
        },
      };

      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Marked Key as Used.');
      expect(res.text).toBe('Key #7 on MyChain');
    });

    it('falls back to active network name (ritonet -> custom local name)', async () => {
      const presenter = await loadPresenterWithConfig('ritonet', 'RitoNet Dev');
      const chip: Chip = {
        output: {
          content: [
            {
              type: 'json',
              data: {
                tokenId: 99,
              },
            },
          ],
        },
      };

      const res = normalizeContent(presenter.success(chip as any));
      expect(res.text).toBe('Key #99 on RitoNet Dev');
    });

    it('omits token id if not finite', async () => {
      const presenter = await loadPresenterWithConfig('sepolia');
      const chip: Chip = {
        output: {
          content: [
            {
              type: 'json',
              data: {
                tokenId: 'NaN',
              },
            },
          ],
        },
      };

      const res = normalizeContent(presenter.success(chip as any));
      expect(res.text).toBe('Key  on Sepolia'); // idPart becomes empty string
    });

    it('falls back to joined text content when no json', async () => {
      const presenter = await loadPresenterWithConfig('sepolia');
      const chip: Chip = {
        output: {
          content: [
            { type: 'text', text: '   line one   ' },
            { type: 'text', text: 'line two' },
          ],
        },
      };

      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Marked Key as Used.');
      expect(res.text).toBe('line one\nline two');
    });
  });

  describe('error()', () => {
    it('maps wallet-like errors to friendly message', async () => {
      const presenter = await loadPresenterWithConfig('sepolia');
      const chip: Chip = { errorText: 'Wallet not connected' };
      const res = normalizeContent(presenter.error(chip as any));
      expect(res.label).toBe('Failed to Mark Key as Used.');
      expect(res.text).toBe('Your wallet must be connected to use this');
    });

    it('passes through specific error text when not wallet-related', async () => {
      const presenter = await loadPresenterWithConfig('sepolia');
      const chip: Chip = { errorText: 'Rate limit exceeded' };
      const res = normalizeContent(presenter.error(chip as any));
      expect(res.text).toBe('Rate limit exceeded');
    });

    it('defaults to generic message when no errorText', async () => {
      const presenter = await loadPresenterWithConfig('sepolia');
      const chip: Chip = {};
      const res = normalizeContent(presenter.error(chip as any));
      expect(res.text).toBe('An unexpected error occurred');
    });
  });
});
