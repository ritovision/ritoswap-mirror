import { normalizeContent, type Chip } from './presenter-test-utils';

async function loadPresenterWithConfig(activeChain: string, localName?: string) {
  vi.resetModules();
  vi.doMock('@/app/config/public.env', () => ({
    publicConfig: { activeChain },
    publicEnv: { NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME: localName },
  }));
  const mod = await import('../presenters/keynft_used_count.presenter');
  return mod.presenter as any;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('keynft_used_count.presenter', () => {
  describe('pending()', () => {
    it('shows label-only pending with empty text', async () => {
      const presenter = await loadPresenterWithConfig('sepolia');
      const res = normalizeContent(presenter.pending({} as any));
      expect(res.label).toBe('Counting Used Keys');
      expect(res.text).toBe('');
    });
  });

  describe('success()', () => {
    it('uses JSON total when provided (number) and includes network name - sepolia', async () => {
      const presenter = await loadPresenterWithConfig('sepolia');
      const chip: Chip = {
        output: {
          content: [
            { type: 'json', data: { total: 42 } },
          ],
        },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Used Keys Total (Sepolia)');
      expect(res.text).toBe('42');
    });

    it('uses JSON total with ritonet custom network name', async () => {
      const presenter = await loadPresenterWithConfig('ritonet', 'RitoNet Dev');
      const chip: Chip = {
        output: { content: [{ type: 'json', data: { total: 7 } }] },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Used Keys Total (RitoNet Dev)');
      expect(res.text).toBe('7');
    });

    it('falls back to joined text when total missing/not a number', async () => {
      const presenter = await loadPresenterWithConfig('ethereum');
      const chip: Chip = {
        output: {
          content: [
            { type: 'json', data: { total: 'not-a-number' } },
            { type: 'text', text: '  approx count: ' },
            { type: 'text', text: '  15  ' },
          ],
        },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Used Keys Total (Ethereum)');
      expect(res.text).toBe('approx count:\n15'); // trimmed and joined with newline
    });

    it('returns empty text when neither json total nor text provided', async () => {
      const presenter = await loadPresenterWithConfig('sepolia');
      const chip: Chip = { output: { content: [{ type: 'json', data: {} }] } };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Used Keys Total (Sepolia)');
      expect(res.text).toBe('');
    });
  });

  describe('error()', () => {
    it('surfaces errorText when provided', async () => {
      const presenter = await loadPresenterWithConfig('sepolia');
      const chip: Chip = { errorText: 'Rate limited' };
      const res = normalizeContent(presenter.error(chip as any));
      expect(res.label).toBe('Failed to Count Used Keys');
      expect(res.text).toBe('Rate limited');
    });

    it('falls back to generic error when no errorText', async () => {
      const presenter = await loadPresenterWithConfig('ethereum');
      const res = normalizeContent(presenter.error({} as any));
      expect(res.label).toBe('Failed to Count Used Keys');
      expect(res.text).toBe('An unexpected error occurred');
    });
  });
});
