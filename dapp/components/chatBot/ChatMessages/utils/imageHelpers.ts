/**
 * Extract attributes (src, alt, width, height) from an <img .../> tag string.
 * Returns empty src when none found.
 */
export function extractImgAttrs(imgTag: string) {
  const src = imgTag.match(/src=["']([^"']+)["']/)?.[1] ?? '';
  const alt = imgTag.match(/alt=["']([^"']*?)["']/)?.[1] ?? 'Image';
  const width = imgTag.match(/width=["']?(\d+)/)?.[1];
  const height = imgTag.match(/height=["']?(\d+)/)?.[1];
  return { src, alt, width, height };
}
