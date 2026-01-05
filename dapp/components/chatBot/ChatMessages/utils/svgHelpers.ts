/**
 * Minimal helpers to ensure SVGs are display-friendly.
 * IMPORTANT: If you render untrusted SVGs, sanitize them with DOMPurify or similar.
 *
 * This version adds:
 *  - xmlns default if missing (prevents some browsers from treating the node as generic XML)
 *  - sensible default size when width/height are missing
 *    • If viewBox exists, default to width=300 and derive height from viewBox aspect ratio
 *    • If no viewBox, default to width=300, height=300
 *  - preserveAspectRatio default (xMidYMid meet) if missing
 */

function ensureXmlns(svg: string) {
  if (!/\bxmlns=/.test(svg)) {
    return svg.replace(
      /<svg/i,
      '<svg xmlns="http://www.w3.org/2000/svg"'
    );
  }
  return svg;
}

export function ensurePreserveAspectRatio(svg: string) {
  if (!/preserveAspectRatio/i.test(svg)) {
    return svg.replace(/<svg/, '<svg preserveAspectRatio="xMidYMid meet"');
  }
  return svg;
}

export function ensureViewBoxFromWH(svg: string) {
  if (!/viewBox/i.test(svg) && (/\bwidth=/i.test(svg) || /\bheight=/i.test(svg))) {
    const widthMatch = svg.match(/width=["']?(\d+(?:\.\d+)?)/i);
    const heightMatch = svg.match(/height=["']?(\d+(?:\.\d+)?)/i);
    const w = widthMatch?.[1];
    const h = heightMatch?.[1];
    if (w && h) {
      return svg.replace(/<svg/, `<svg viewBox="0 0 ${w} ${h}"`);
    }
  }
  return svg;
}

/**
 * Ensure the SVG has explicit width/height so it isn't collapsed by layout.
 * - If width/height are both missing:
 *   - If viewBox is present, set width=300 and derive height using the aspect ratio.
 *   - Else, set width=300 and height=300 (square fallback).
 */
function ensureDefaultSize(svg: string) {
  const hasWidth = /\bwidth\s*=/.test(svg);
  const hasHeight = /\bheight\s*=/.test(svg);

  if (hasWidth || hasHeight) return svg;

  const vbMatch = svg.match(/viewBox\s*=\s*["']\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*["']/i);

  if (vbMatch) {
    const vbW = parseFloat(vbMatch[3]);
    const vbH = parseFloat(vbMatch[4]);
    const width = 300;
    const height = Number.isFinite(vbW) && vbW > 0 && Number.isFinite(vbH) && vbH > 0
      ? Math.round(width * (vbH / vbW))
      : 300;

    return svg.replace(/<svg/, `<svg width="${width}" height="${height}"`);
  }

  // No width/height and no viewBox: give a square default
  return svg.replace(/<svg/, `<svg width="300" height="300"`);
}

export function prepareSvg(svg: string) {
  let out = svg || '';
  out = ensureXmlns(out);
  out = ensurePreserveAspectRatio(out);
  out = ensureViewBoxFromWH(out);
  out = ensureDefaultSize(out);
  return out;
}
