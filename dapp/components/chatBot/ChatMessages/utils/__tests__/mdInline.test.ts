import { normalizeSpaces, parseInlineMd } from '../mdInline';

type Run = { type: 'text' | 'strong' | 'em'; content: string };

const asTuples = (runs: Run[]) => runs.map(r => [r.type, r.content]);

describe('normalizeSpaces', () => {
  it('converts &nbsp; variants and NBSP unicode to plain spaces', () => {
    const input = 'a&nbsp;b&#160;c&#xA0;d\u00A0e\u2007f\u202Fg';
    const out = normalizeSpaces(input);
    expect(out).toBe('a b c d e f g');
  });

  it('turns backslash-space/tab/newline into a single space', () => {
    const input = 'a\\ b\\\tb\\\nc\\\rd';
    const out = normalizeSpaces(input);
    expect(out).toBe('a b b c d');
  });

  it('returns empty string for falsy input', () => {
    // @ts-expect-error testing falsy
    expect(normalizeSpaces(null)).toBe('');
    // @ts-expect-error testing falsy
    expect(normalizeSpaces(undefined)).toBe('');
    expect(normalizeSpaces('')).toBe('');
  });
});

describe('parseInlineMd', () => {
  it('returns [] for empty or falsy input', () => {
    expect(parseInlineMd('')).toEqual([]);
    // @ts-expect-error
    expect(parseInlineMd(undefined)).toEqual([]);
  });

  it('parses **bold** and *italic*', () => {
    const runs = parseInlineMd('hi **B** and *i*');
    expect(asTuples(runs)).toEqual([
      ['text', 'hi '],
      ['strong', 'B'],
      ['text', ' and '],
      ['em', 'i'],
    ]);
  });

  it('parses __bold__ and _italic_', () => {
    const runs = parseInlineMd('x __bold__ y _it_');
    expect(asTuples(runs)).toEqual([
      ['text', 'x '],
      ['strong', 'bold'],
      ['text', ' y '],
      ['em', 'it'],
    ]);
  });

  it('prefers bold markers over italic when both could match at same position', () => {
    const runs = parseInlineMd('**b** *i*');
    expect(asTuples(runs)).toEqual([
      ['strong', 'b'],
      ['text', ' '],
      ['em', 'i'],
    ]);
  });

  it('keeps text literal when no closing marker is found', () => {
    const runs = parseInlineMd('oops **no-close and _still-open');
    expect(asTuples(runs)).toEqual([
      ['text', 'oops '],
      ['text', '**'],
      ['text', 'no-close and '],
      ['text', '_'],
      ['text', 'still-open'],
    ]);
  });

  it('respects escapes by unescaping then parsing: \\*, \\_, \\#, \\\\', () => {
    // unescapeMarkers(): \* -> *, \_ -> _, \# -> #, \\ -> \
    const runs = parseInlineMd(String.raw`escaped \*not bold\* and \_not it\_ \#hash \\slash`);
    expect(asTuples(runs)).toEqual([
      ['text', 'escaped '],
      ['em', 'not bold'],       // became *not bold*
      ['text', ' and '],
      ['em', 'not it'],         // became _not it_
      ['text', ' #hash \\slash'], // \# -> #, \\ -> \ (single backslash remains in string as "\\")
    ]);
  });

  it('normalizes NBSP/&nbsp; etc. inside text before parsing markers', () => {
    const runs = parseInlineMd('A&nbsp;**B**\u00A0_C_');
    expect(asTuples(runs)).toEqual([
      ['text', 'A '],
      ['strong', 'B'],
      ['text', ' '],
      ['em', 'C'],
    ]);
  });

  it('handles multiple markers in sequence and plain text between', () => {
    const runs = parseInlineMd('**bold**text*it***mix**');
    // '**bold**' -> strong('bold')
    // 'text'     -> text
    // '*it*'     -> em('it')
    // '***mix**' -> '**' opens bold, 'mix' until '**' closes -> strong('mix')
    expect(asTuples(runs)).toEqual([
      ['strong', 'bold'],
      ['text', 'text'],
      ['em', 'it'],
      ['strong', 'mix'],
    ]);
  });

  it('does not merge adjacent runs of different types, preserves order', () => {
    const runs = parseInlineMd('a**b**c*d*e');
    expect(asTuples(runs)).toEqual([
      ['text', 'a'],
      ['strong', 'b'],
      ['text', 'c'],
      ['em', 'd'],
      ['text', 'e'],
    ]);
  });

  it('unescapes then parses escaped sequences and preserves remaining backslashes', () => {
    // \*\* -> ** (bold), \_it\_ -> _it_ (italic), \\ -> \
    const runs = parseInlineMd(String.raw`\*\*not bold\*\* and text \_it\_ \\ end`);
    expect(asTuples(runs)).toEqual([
      ['strong', 'not bold'],
      ['text', ' and text '],
      ['em', 'it'],
      ['text', ' \\ end'],
    ]);
  });

  it('handles strings with no markers (single text run)', () => {
    const runs = parseInlineMd('just text');
    expect(asTuples(runs)).toEqual([['text', 'just text']]);
  });
});
