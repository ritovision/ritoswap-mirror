import { extractSpeakableText } from '../extractSpeakableText';

describe('extractSpeakableText', () => {
  it('returns empty string for empty input', () => {
    expect(extractSpeakableText('')).toBe('');
  });

  it('normalizes whitespace across lines', () => {
    const input = 'hello\n\nworld';
    expect(extractSpeakableText(input)).toBe('hello world');
  });

  it('extracts readable text from headings and bold', () => {
    const input = '# Hello **World**';
    expect(extractSpeakableText(input)).toBe('Hello World');
  });

  it('uses link labels in plain text', () => {
    const input = 'See [Label](https://example.com) now';
    expect(extractSpeakableText(input)).toBe('See Label now');
  });

  it('ignores media tags while keeping surrounding text', () => {
    const input = 'Start <img src="x" /> middle <gif src="y" /> end';
    expect(extractSpeakableText(input)).toBe('Start middle end');
  });
});
