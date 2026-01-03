import { prepareSvg, ensureViewBoxFromWH, ensurePreserveAspectRatio } from '../svgHelpers';

describe('svgHelpers - prepareSvg', () => {
  it('adds xmlns when missing', () => {
    const input = `<svg viewBox="0 0 10 10"></svg>`;
    const out = prepareSvg(input);
    expect(out).toMatch(/<svg[^>]*\sxmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  });

  it('does not duplicate xmlns if already present', () => {
    const input = `<svg xmlns="http://www.w3.org/2000/svg"></svg>`;
    const out = prepareSvg(input);
    // only one xmlns attribute
    const match = out.match(/xmlns=/g);
    expect(match?.length).toBe(1);
  });

  it('adds preserveAspectRatio="xMidYMid meet" when missing', () => {
    const input = `<svg xmlns="http://www.w3.org/2000/svg"></svg>`;
    const out = prepareSvg(input);
    expect(out).toMatch(/preserveAspectRatio="xMidYMid meet"/);
  });

  it('does not override existing preserveAspectRatio', () => {
    const input = `<svg preserveAspectRatio="none"></svg>`;
    const out = prepareSvg(input);
    expect(out).toMatch(/preserveAspectRatio="none"/);
  });

  it('derives viewBox from width/height if viewBox is missing', () => {
    const input = `<svg width="200" height="100"></svg>`;
    const out = prepareSvg(input);
    // ensureViewBoxFromWH should add this:
    expect(out).toMatch(/viewBox="0 0 200 100"/);
    // prepareSvg should also add xmlns & preserveAspectRatio, but keep width/height as given
    expect(out).toMatch(/width="200"/);
    expect(out).toMatch(/height="100"/);
  });

  it('sets default width/height when both are missing and viewBox defines aspect ratio', () => {
    const input = `<svg viewBox="0 0 400 100"></svg>`;
    const out = prepareSvg(input);
    // width defaults to 300; height derived = 300 * (100/400) = 75
    expect(out).toMatch(/width="300"/);
    expect(out).toMatch(/height="75"/);
  });

  it('sets square default width/height when both missing and no viewBox', () => {
    const input = `<svg></svg>`;
    const out = prepareSvg(input);
    expect(out).toMatch(/width="300"/);
    expect(out).toMatch(/height="300"/);
  });

  it('keeps existing width/height as-is (does not override explicit size)', () => {
    const input = `<svg width="640" height="480" viewBox="0 0 640 480"></svg>`;
    const out = prepareSvg(input);
    expect(out).toMatch(/width="640"/);
    expect(out).toMatch(/height="480"/);
    expect(out).toMatch(/viewBox="0 0 640 480"/);
  });

  it('is idempotent (running twice does not duplicate attributes)', () => {
    const input = `<svg viewBox="0 0 10 10"></svg>`;
    const once = prepareSvg(input);
    const twice = prepareSvg(once);

    expect(twice).toBe(once);
    // sanity: only one xmlns and one preserveAspectRatio
    expect((twice.match(/xmlns=/g) || []).length).toBe(1);
    expect((twice.match(/preserveAspectRatio=/g) || []).length).toBe(1);
  });
});

describe('svgHelpers - ensureViewBoxFromWH', () => {
  it('adds viewBox when width/height present and viewBox missing', () => {
    const input = `<svg width="123" height="45"></svg>`;
    const out = ensureViewBoxFromWH(input);
    expect(out).toMatch(/viewBox="0 0 123 45"/);
  });

  it('keeps original when viewBox already present', () => {
    const input = `<svg width="10" height="10" viewBox="0 0 10 10"></svg>`;
    const out = ensureViewBoxFromWH(input);
    expect(out).toBe(input);
  });

  it('no change when neither width nor height present', () => {
    const input = `<svg></svg>`;
    const out = ensureViewBoxFromWH(input);
    expect(out).toBe(input);
  });
});

describe('svgHelpers - ensurePreserveAspectRatio', () => {
  it('adds default preserveAspectRatio when missing', () => {
    const input = `<svg></svg>`;
    const out = ensurePreserveAspectRatio(input);
    expect(out).toMatch(/preserveAspectRatio="xMidYMid meet"/);
  });

  it('does not change when preserveAspectRatio exists', () => {
    const input = `<svg preserveAspectRatio="none"></svg>`;
    const out = ensurePreserveAspectRatio(input);
    expect(out).toBe(input);
  });
});
