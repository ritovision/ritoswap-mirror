import { presenter } from '../presenters/keynft_manage.presenter';

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

describe('keynft_manage.presenter', () => {
  describe('pending()', () => {
    it('shows Minting when action=mint', () => {
      const res = normalizeContent(presenter.pending({ input: { action: 'mint' } } as any));
      expect(res.label).toBe('Key NFT: Minting…');
      expect(res.text).toBe('');
    });

    it('shows Burning when action=burn', () => {
      const res = normalizeContent(presenter.pending({ input: { action: 'burn' } } as any));
      expect(res.label).toBe('Key NFT: Burning…');
      expect(res.text).toBe('');
    });

    it('defaults to Querying when action missing/unknown', () => {
      const res = normalizeContent(presenter.pending({ input: {} } as any));
      expect(res.label).toBe('Key NFT: Querying…');
      expect(res.text).toBe('');
    });
  });

  describe('success() - tool text path', () => {
    it('uses tool-provided text when present and labels by action (json.action)', () => {
      const chip: Chip = {
        input: { action: 'burn' }, // should be ignored in favor of json.action
        output: {
          content: [
            { type: 'text', text: ' concise status line ' },
            { type: 'json', data: { action: 'mint' } }, // action deduced from json
          ],
        },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Key NFT Minted.');
      expect(res.text).toBe('concise status line'); // trimmed and used as-is
    });

    it('falls back to input action when json.action missing', () => {
      const chip: Chip = {
        input: { action: 'burn' },
        output: { content: [{ type: 'text', text: 'ok' }] },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Key NFT Burned.');
      expect(res.text).toBe('ok');
    });
  });

  describe('success() - derived summaries', () => {
    it('query: has token with colors and timeline summary (last 3 messages)', () => {
      const chip: Chip = {
        input: { action: 'query' },
        output: {
          content: [
            {
              type: 'json',
              data: {
                action: 'query',
                hasToken: true,
                tokenId: '42',
                colors: { backgroundColor: '#000', keyColor: '#fff' },
                timeline: [
                  { phase: 'query', message: 'Checking ownership' },
                  { phase: 'result', message: 'Token found' },
                  { phase: 'result', message: 'Reading metadata' },
                  { phase: 'result', message: 'Done' },
                ],
              },
            },
          ],
        },
      };

      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Key NFT Status.');
      expect(res.text).toContain('Has token #42 (bg: #000, key: #fff)');
      // last 3 joined with arrow and placed on a new line
      expect(res.text).toContain('\nToken found → Reading metadata → Done');
    });

    it('query: no token', () => {
      const chip: Chip = {
        input: { action: 'query' },
        output: { content: [{ type: 'json', data: { hasToken: false } }] },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Key NFT Status.');
      expect(res.text).toBe('No NFT for this signer.');
    });

    it('burn: burnedTokenId present', () => {
      const chip: Chip = {
        input: { action: 'burn' },
        output: { content: [{ type: 'json', data: { burnedTokenId: '77' } }] },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Key NFT Burned.');
      expect(res.text).toBe('Burned token #77.');
    });

    it('burn: no token to burn', () => {
      const chip: Chip = {
        input: { action: 'burn' },
        output: { content: [{ type: 'json', data: {} }] },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Key NFT Burned.');
      expect(res.text).toBe('No NFT to burn.');
    });

    it('mint: minted with previous burned and colors', () => {
      const chip: Chip = {
        input: { action: 'mint' },
        output: {
          content: [
            {
              type: 'json',
              data: {
                tokenId: '101',
                burnedTokenId: '100',
                colors: { backgroundColor: '#112233', keyColor: '#445566' },
              },
            },
          ],
        },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Key NFT Minted.');
      expect(res.text).toBe('Previous #100 burned. Minted #101 (bg: #112233, key: #445566).');
    });

    it('mint: attempted but token not detected', () => {
      const chip: Chip = {
        input: { action: 'mint' },
        output: { content: [{ type: 'json', data: {} }] },
      };
      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Key NFT Minted.');
      expect(res.text).toBe('Mint attempted, but token not detected on re-query.');
    });
  });

  describe('error()', () => {
    it('returns error label and provided text', () => {
      const chip: Chip = { errorText: 'Boom' };
      const res = normalizeContent(presenter.error(chip as any));
      expect(res.label).toBe('Key NFT Action Failed.');
      expect(res.text).toBe('Boom');
    });

    it('falls back to generic error message', () => {
      const res = normalizeContent(presenter.error({} as any));
      expect(res.label).toBe('Key NFT Action Failed.');
      expect(res.text).toBe('An unexpected error occurred.');
    });
  });
});
