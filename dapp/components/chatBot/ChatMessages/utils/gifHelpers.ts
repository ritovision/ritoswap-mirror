/**
 * Helpers for <gif .../> tags.
 */

/** Return true if value is an absolute http(s) URL. */
export function isAbsoluteUrl(v: string): boolean {
  return /^https?:\/\//i.test(v || '');
}

/**
 * Resolve a user-provided path to a usable <img src>.
 * - http(s) stays as-is
 * - leading "/" stays as-is (Next.js public root)
 * - everything else becomes "/gifs/<value>"
 * - normalizes backslashes to forward slashes
 */
export function resolveGifSrc(input: string): string {
  if (!input) return '';
  let v = String(input).trim();

  // normalize windows-style slashes
  v = v.replace(/\\+/g, '/');

  if (isAbsoluteUrl(v)) return v;

  // already pointing at public root
  if (v.startsWith('/')) return v;

  // strip leading "./" or "../" fragments without full path resolution (keeps it simple)
  v = v.replace(/^\.?\//, '').replace(/^\.\.\//, '');

  // if user put "gifs/foo.gif", keep that folder under public
  if (!/^gifs\//i.test(v)) v = `gifs/${v}`;

  return `/${v}`;
}

/**
 * Extract attrs from a <gif .../> token (used rarely; parser uses its own attr reader too).
 */
export function extractGifAttrs(gifTag: string) {
  const src = gifTag.match(/(?:src|url|href)=["']([^"']+)["']/i)?.[1] ?? '';
  const alt = gifTag.match(/alt=["']([^"']*?)["']/i)?.[1] ?? 'GIF';
  const width = gifTag.match(/width=["']?(\d+)/i)?.[1];
  const height = gifTag.match(/height=["']?(\d+)/i)?.[1];
  return { src: resolveGifSrc(src), alt, width, height };
}
