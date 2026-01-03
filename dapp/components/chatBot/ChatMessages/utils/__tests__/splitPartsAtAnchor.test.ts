import { splitPartsAtAnchor } from '../splitPartsAtAnchor';
import type { Message } from '../../types';

const makeParts = (texts: string[]): Message['parts'] =>
  texts.map((t) => ({ type: 'text' as const, text: t }));

describe('splitPartsAtAnchor', () => {
  it('returns all parts in "before" and empty "after" when no anchor', () => {
    const parts = makeParts(['hello', 'world']);
    const res = splitPartsAtAnchor(parts, undefined);
    expect(res.before).toEqual(parts);
    expect(res.after).toEqual([]);
  });

  it('splits within a single part at a middle offset', () => {
    const parts = makeParts(['abcdef']);
    const res = splitPartsAtAnchor(parts, { partIndex: 0, charOffset: 3 });
    expect(res.before).toEqual([{ type: 'text', text: 'abc' }]);
    expect(res.after).toEqual([{ type: 'text', text: 'def' }]);
  });

  it('offset 0 yields empty head (not added) and full tail in "after"', () => {
    const parts = makeParts(['abc', 'XYZ']);
    const res = splitPartsAtAnchor(parts, { partIndex: 0, charOffset: 0 });
    // head was empty, so not pushed
    expect(res.before).toEqual([]);
    // tail from target + remaining parts
    expect(res.after).toEqual([
      { type: 'text', text: 'abc' },
      { type: 'text', text: 'XYZ' },
    ]);
  });

  it('offset equal to length yields full head in "before" and no tail from target; remaining parts go to "after"', () => {
    const parts = makeParts(['abc', 'def']);
    const res = splitPartsAtAnchor(parts, { partIndex: 0, charOffset: 3 });
    expect(res.before).toEqual([{ type: 'text', text: 'abc' }]);
    expect(res.after).toEqual([{ type: 'text', text: 'def' }]); // only remaining parts
  });

  it('splits a middle part and moves all later parts to "after"', () => {
    const parts = makeParts(['first', 'second', 'third']);
    const res = splitPartsAtAnchor(parts, { partIndex: 1, charOffset: 3 });
    expect(res.before).toEqual([
      { type: 'text', text: 'first' },
      { type: 'text', text: 'sec' },
    ]);
    expect(res.after).toEqual([
      { type: 'text', text: 'ond' },
      { type: 'text', text: 'third' },
    ]);
  });

  it('clamps partIndex above bounds to last part and charOffset above length to end', () => {
    const parts = makeParts(['a', 'bb']);
    const res = splitPartsAtAnchor(parts, { partIndex: 99, charOffset: 99 });
    // last part is index 1, offset clamped to length 2
    expect(res.before).toEqual([
      { type: 'text', text: 'a' },
      { type: 'text', text: 'bb' },
    ]);
    // no tail from target because offset == length
    expect(res.after).toEqual([]);
  });

  it('clamps negative partIndex to 0 and negative charOffset to 0', () => {
    const parts = makeParts(['hello', 'world']);
    const res = splitPartsAtAnchor(parts, { partIndex: -5, charOffset: -1 });
    // head empty (offset 0), so not pushed
    expect(res.before).toEqual([]);
    // tail of first + remaining parts
    expect(res.after).toEqual([
      { type: 'text', text: 'hello' },
      { type: 'text', text: 'world' },
    ]);
  });

  it('handles non-string text values by stringifying safely', () => {
    // Force a non-string to cover the fallback path
    const parts = [{ type: 'text' as const, text: 123 as unknown as string }];
    const res = splitPartsAtAnchor(parts, { partIndex: 0, charOffset: 1 });
    expect(res.before).toEqual([{ type: 'text', text: '1' }]);
    expect(res.after).toEqual([{ type: 'text', text: '23' }]);
  });

  it('when target part missing (empty parts), returns original before and empty after', () => {
    const parts: Message['parts'] = [];
    const res = splitPartsAtAnchor(parts, { partIndex: 0, charOffset: 0 });
    expect(res.before).toEqual(parts);
    expect(res.after).toEqual([]);
  });
});
