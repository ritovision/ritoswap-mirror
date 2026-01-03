import { presenter } from '../presenters/generate_image_with_alt.presenter';

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

describe('generate_image_with_alt.presenter', () => {
  describe('pending()', () => {
    it('returns a label-only pending state', () => {
      const res = normalizeContent(presenter.pending({} as any));
      expect(res.label).toBe('Generating image…');
      expect(res.text).toBe('');
    });
  });

  describe('success()', () => {
    it('shows name and size when payload kind is "store-image"', () => {
      const chip: Chip = {
        output: {
          content: [
            {
              type: 'json',
              data: {
                kind: 'store-image',
                name: 'sunset.png',
                width: 1024,
                height: 768,
              },
            },
          ],
        },
      };

      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Image ready');
      // uses multiplication sign ×
      expect(res.text).toBe('sunset.png (1024×768)');
    });

    it('shows only size when name is missing and trims properly', () => {
      const chip: Chip = {
        output: {
          content: [
            {
              type: 'json',
              data: {
                kind: 'store-image',
                width: 300,
                height: 600,
              },
            },
          ],
        },
      };

      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Image ready');
      expect(res.text).toBe('(300×600)'); // trimmed, no leading space
    });

    it('shows only name when size is missing', () => {
      const chip: Chip = {
        output: {
          content: [
            {
              type: 'json',
              data: {
                kind: 'store-image',
                name: 'avatar.jpg',
                // no width/height
              },
            },
          ],
        },
      };

      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Image ready');
      expect(res.text).toBe('avatar.jpg');
    });

    it('falls back to empty text when json kind is not "store-image"', () => {
      const chip: Chip = {
        output: {
          content: [
            { type: 'json', data: { kind: 'other', foo: 'bar' } },
          ],
        },
      };

      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Image ready');
      expect(res.text).toBe('');
    });

    it('falls back to empty text when no json content present', () => {
      const chip: Chip = {
        output: {
          content: [
            { type: 'text', text: 'some text that should be ignored by presenter' },
          ],
        },
      };

      const res = normalizeContent(presenter.success(chip as any));
      expect(res.label).toBe('Image ready');
      expect(res.text).toBe('');
    });
  });

  describe('error()', () => {
    it('surfaces errorText when provided', () => {
      const chip: Chip = { errorText: 'Render service unavailable' };
      const res = normalizeContent(presenter.error(chip as any));
      expect(res.label).toBe('Image failed');
      expect(res.text).toBe('Render service unavailable');
    });

    it('uses generic error message when errorText is missing', () => {
      const res = normalizeContent(presenter.error({} as any));
      expect(res.label).toBe('Image failed');
      expect(res.text).toBe('An unexpected error occurred');
    });
  });
});
