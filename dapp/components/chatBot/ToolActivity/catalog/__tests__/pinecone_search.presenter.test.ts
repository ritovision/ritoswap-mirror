import { presenter } from '../presenters/pinecone_search.presenter';

type Chip = {
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

// Normalize ToolChipContent (string | {label?, text?}) to an object with label/text fields
function normalizeContent(c: unknown): { label?: string; text?: string } {
  if (typeof c === 'string') return { label: '', text: c };
  if (c && typeof c === 'object') {
    const obj = c as { label?: string; text?: string };
    return { label: obj.label, text: obj.text };
  }
  return { label: '', text: '' };
}

describe('pinecone_search.presenter', () => {
  describe('pending()', () => {
    it('shows "Searching" with truncated query only', () => {
      const longQuery = 'a'.repeat(60);
      const chip: Chip = {
        input: { query: longQuery },
      };

      const res = normalizeContent(presenter.pending(chip as any));

      expect(res.label).toBe('Searching');
      // pending truncates to 30 chars incl. ellipsis (27 + '...')
      expect(res.text).toBe(`"${'a'.repeat(27)}..."`);
    });

    it('includes index and namespace in label when provided', () => {
      const chip: Chip = {
        input: { query: 'hello world', index: 'myindex', namespace: 'docs' },
      };

      const res = normalizeContent(presenter.pending(chip as any));

      expect(res.label).toBe('Searching myindex/docs');
      expect(res.text).toBe('"hello world"');
    });

    it('omits namespace if not present', () => {
      const chip: Chip = {
        input: { query: 'q', index: 'idx' },
      };
      const res = normalizeContent(presenter.pending(chip as any));
      expect(res.label).toBe('Searching idx');
    });

    it('handles non-object input gracefully', () => {
      const chip: Chip = { input: null };
      const res = normalizeContent(presenter.pending(chip as any));
      expect(res.label).toBe('Searching');
      expect(res.text).toBe('');
    });
  });

  describe('success()', () => {
    it('formats label, query, top score, and best match (with truncations)', () => {
      const longQuery = 'the quick brown fox jumps over the lazy dog while humming a tune';
      const longTitle =
        'This is a very long title that should definitely be truncated beyond fifty characters';

      const chip: Chip = {
        output: {
          content: [
            {
              type: 'json',
              data: {
                totalMatches: 1,
                index: 'myindex',
                namespace: 'ns',
                query: longQuery,
                matches: [
                  {
                    score: 0.98765,
                    metadata: { title: longTitle },
                  },
                ],
              },
            },
          ],
        },
      };

      const res = normalizeContent(presenter.success(chip as any));

      // pluralization and index/ns inclusion
      expect(res.label).toBe('Found 1 result in myindex/ns');

      // success truncates query to 40 incl. ellipsis (37 + '...')
      const expectedQuery = `Query: "${longQuery.slice(0, 37)}..."`;

      // title is truncated to 50 incl. ellipsis (47 + '...')
      const expectedTruncatedTitle = `${longTitle.slice(0, 47)}...`;
      const expectedTopScore = 'Top score: 0.988';

      // text should be multiline, in this order
      expect(res.text).toContain(expectedQuery);
      expect(res.text).toContain(expectedTopScore);
      expect(res.text).toContain(`Best match: ${expectedTruncatedTitle}`);
    });

    it('omits "/default" namespace in the label', () => {
      const chip: Chip = {
        output: {
          content: [
            {
              type: 'json',
              data: {
                totalMatches: 2,
                index: 'catalog',
                namespace: 'default',
                query: 'short',
                matches: [],
              },
            },
          ],
        },
      };

      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Found 2 results in catalog');
      expect(res.text).toBe('Query: "short"'); // no top score or best match
    });

    it('falls back to text output when JSON is missing', () => {
      const chip: Chip = {
        output: {
          content: [
            { type: 'text', text: '   line one   ' },
            { type: 'text', text: 'line two' },
          ],
        },
      };

      const res = normalizeContent(presenter.success(chip as any));

      expect(res.label).toBe('Search Complete');
      // trims and joins by newline
      expect(res.text).toBe('line one\nline two');
    });

    it('uses default text when no query and no matches in JSON', () => {
      const chip: Chip = {
        output: {
          content: [
            {
              type: 'json',
              data: {
                totalMatches: 0,
                index: 'idx',
                // no namespace, no query, no matches
              },
            },
          ],
        },
      };

      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Found 0 results in idx');
      expect(res.text).toBe('0 results');
    });
  });

  describe('error()', () => {
    it('maps API key errors to friendly message', () => {
      const chip: Chip = {
        input: { query: 'q', index: 'idx' },
        errorText: 'Missing API key for Pinecone',
      };

      const res = normalizeContent(presenter.error(chip as any));
      expect(res.label).toBe('Search Failed');
      expect(res.text).toBe('Pinecone API key not configured');
    });

    it('maps "not found" errors to index-specific message', () => {
      const chip: Chip = {
        input: { query: 'q', index: 'products' },
        errorText: 'Index not found',
      };

      const res = normalizeContent(presenter.error(chip as any));
      expect(res.text).toBe('Index "products" not found');
    });

    it('maps "Authentication" errors to friendly message', () => {
      const chip: Chip = {
        input: { query: 'q' },
        errorText: 'Authentication error: invalid token',
      };

      const res = normalizeContent(presenter.error(chip as any));
      expect(res.text).toBe('Authentication required');
    });

    it('passes through generic error text', () => {
      const chip: Chip = {
        input: { query: 'q' },
        errorText: 'Something unknown happened',
      };

      const res = normalizeContent(presenter.error(chip as any));
      expect(res.text).toBe('Something unknown happened');
    });

    it('defaults to "Search failed" when no errorText', () => {
      const chip: Chip = {
        input: { query: 'q' },
      };

      const res = normalizeContent(presenter.error(chip as any));
      expect(res.text).toBe('Search failed');
    });
  });
});
