import { presenters } from '../generated-presenters';
import * as indexMod from '../index';

// tiny runtime type guard for ToolChipContent
function isValidContent(x: any): x is string | { label?: any; text: any } {
  if (typeof x === 'string') return true;
  if (!x || typeof x !== 'object') return false;
  return 'text' in x && typeof x.text === 'string';
}

describe('generated presenters contract', () => {
  it('every generated presenter has required shape and does not throw for simple chips', () => {
    for (const [name, p] of Object.entries(presenters)) {
      if (!p) continue; // presenters is Partial<Record<...>>
      expect(typeof p.toolName).toBe('string');
      expect(typeof p.pending).toBe('function');
      expect(typeof p.success).toBe('function');
      expect(typeof p.error).toBe('function');

      const baseChip = {
        toolCallId: 't',
        toolName: p.toolName,
        createdAt: Date.now(),
      } as const;

      // none of these should throw for minimal inputs
      const pending = p.pending({ ...baseChip, status: 'pending' } as any);
      const success = p.success({ ...baseChip, status: 'success' } as any);
      const error = p.error({ ...baseChip, status: 'error', errorText: 'boom' } as any);

      expect(isValidContent(pending)).toBe(true);
      expect(isValidContent(success)).toBe(true);
      expect(isValidContent(error)).toBe(true);
    }
  });

  it('catalog.getPresenter returns the same instance for each known toolName; unknown -> default', () => {
    for (const [name, p] of Object.entries(presenters)) {
      if (!p) continue;
      const got = indexMod.getPresenter(name);
      expect(got).toBe(p);
    }
    // sanity: unknown uses default (not strictly equal to any generated)
    const unknown = indexMod.getPresenter('__nope__');
    expect(Object.values(presenters)).not.toContain(unknown);
  });
});
