import { extractImgAttrs } from '../imageHelpers';

describe('imageHelpers.extractImgAttrs', () => {
  it('parses src, alt, width, height with double quotes', () => {
    const tag = `<img src="/foo.png" alt="Foo" width="300" height="200" />`;
    const res = extractImgAttrs(tag);
    expect(res).toEqual({ src: '/foo.png', alt: 'Foo', width: '300', height: '200' });
  });

  it('parses with single quotes', () => {
    const tag = `<img src='/bar.jpg' alt='Bar' width='123' height='45'/>`;
    const res = extractImgAttrs(tag);
    expect(res).toEqual({ src: '/bar.jpg', alt: 'Bar', width: '123', height: '45' });
  });

  it('handles mixed attribute order and extra attrs', () => {
    const tag = `<img height="10" data-x="1" alt="A" width="20" src="/x.png" />`;
    const res = extractImgAttrs(tag);
    expect(res).toEqual({ src: '/x.png', alt: 'A', width: '20', height: '10' });
  });

  it('defaults alt to "Image" when missing', () => {
    const tag = `<img src="/only-src.png" />`;
    const res = extractImgAttrs(tag);
    expect(res).toEqual({ src: '/only-src.png', alt: 'Image', width: undefined, height: undefined });
  });

  it('returns empty src when missing', () => {
    const tag = `<img alt="no src" width="10" height="10" />`;
    const res = extractImgAttrs(tag);
    expect(res.src).toBe('');
    expect(res.alt).toBe('no src');
  });

  it('width/height can be unquoted numbers', () => {
    const tag = `<img src="/a.png" width=640 height=480>`;
    const res = extractImgAttrs(tag);
    expect(res).toEqual({ src: '/a.png', alt: 'Image', width: '640', height: '480' });
  });

  it('width/height ignore non-numeric suffixes beyond digits', () => {
    const tag = `<img src="/a.png" width="640px" height='480px' alt="A">`;
    const res = extractImgAttrs(tag);
    // current regex captures the numeric prefix only
    expect(res.width).toBe('640');
    expect(res.height).toBe('480');
  });

  it('empty tag yields defaults', () => {
    const res = extractImgAttrs(`<img />`);
    expect(res).toEqual({ src: '', alt: 'Image', width: undefined, height: undefined });
  });
});
