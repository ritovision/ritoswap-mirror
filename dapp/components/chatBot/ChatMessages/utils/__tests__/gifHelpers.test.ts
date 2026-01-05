import { isAbsoluteUrl, resolveGifSrc, extractGifAttrs } from '../gifHelpers';

describe('gifHelpers.isAbsoluteUrl', () => {
  it('detects http/https', () => {
    expect(isAbsoluteUrl('http://a.com/x.gif')).toBe(true);
    expect(isAbsoluteUrl('https://a.com/x.gif')).toBe(true);
  });
  it('returns false for relative paths', () => {
    expect(isAbsoluteUrl('/x.gif')).toBe(false);
    expect(isAbsoluteUrl('x.gif')).toBe(false);
    expect(isAbsoluteUrl('gifs/x.gif')).toBe(false);
  });
  it('handles empty/garbage safely', () => {
    // @ts-expect-error
    expect(isAbsoluteUrl(null)).toBe(false);
    expect(isAbsoluteUrl('')).toBe(false);
  });
});

describe('gifHelpers.resolveGifSrc', () => {
  it('keeps absolute URLs as-is', () => {
    expect(resolveGifSrc('https://cdn/x.gif')).toBe('https://cdn/x.gif');
  });

  it('keeps leading slash (public root) as-is', () => {
    expect(resolveGifSrc('/x.gif')).toBe('/x.gif');
  });

  it('normalizes backslashes and prefixes /gifs/ if needed', () => {
    expect(resolveGifSrc('folder\\x.gif')).toBe('/gifs/folder/x.gif');
    expect(resolveGifSrc('x.gif')).toBe('/gifs/x.gif');
    expect(resolveGifSrc('nested\\a\\b.gif')).toBe('/gifs/nested/a/b.gif');
  });

  it('strips leading ./ and ../ (single hop) without full resolution', () => {
    expect(resolveGifSrc('./x.gif')).toBe('/gifs/x.gif');
    expect(resolveGifSrc('../x.gif')).toBe('/gifs/x.gif');
  });

  it('does not double-prefix when already starting with gifs/', () => {
    expect(resolveGifSrc('gifs/foo.gif')).toBe('/gifs/foo.gif');
    expect(resolveGifSrc('gifs\\bar.gif')).toBe('/gifs/bar.gif');
  });

  it('empty input returns empty string', () => {
    expect(resolveGifSrc('')).toBe('');
    // @ts-expect-error
    expect(resolveGifSrc(null)).toBe('');
  });
});

describe('gifHelpers.extractGifAttrs', () => {
  it('reads src/url/href and resolves via resolveGifSrc', () => {
    const t1 = `<gif src="x.gif" alt="A" width="200" height="100" />`;
    expect(extractGifAttrs(t1)).toEqual({
      src: '/gifs/x.gif',
      alt: 'A',
      width: '200',
      height: '100',
    });

    const t2 = `<gif url='folder\\y.gif' alt='B' width='50' height='60'/>`;
    expect(extractGifAttrs(t2)).toEqual({
      src: '/gifs/folder/y.gif',
      alt: 'B',
      width: '50',
      height: '60',
    });

    const t3 = `<gif href="https://cdn/z.gif" />`;
    expect(extractGifAttrs(t3)).toEqual({
      src: 'https://cdn/z.gif',
      alt: 'GIF',
      width: undefined,
      height: undefined,
    });
  });

  it('defaults alt to "GIF" and leaves width/height undefined when not present', () => {
    const tag = `<gif src="foo.gif" />`;
    expect(extractGifAttrs(tag)).toEqual({
      src: '/gifs/foo.gif',
      alt: 'GIF',
      width: undefined,
      height: undefined,
    });
  });

  it('handles unquoted width/height', () => {
    const tag = `<gif src="/a.gif" width=320 height=240 alt="A" />`;
    const res = extractGifAttrs(tag);
    expect(res.width).toBe('320');
    expect(res.height).toBe('240');
  });

  it('handles mixed/extra attributes and odd spacing', () => {
    const tag = `<gif height="10"  data-x='1' src='nested\\m.gif'  alt="X"   width="20"/>`;
    const res = extractGifAttrs(tag);
    expect(res).toEqual({
      src: '/gifs/nested/m.gif',
      alt: 'X',
      width: '20',
      height: '10',
    });
  });
});
