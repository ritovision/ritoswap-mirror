// dapp/components/utilities/chatBot/ChatMessages/utils/parseContentWithMedia.ts
import type { MediaSegment } from '../types';
import { resolveGifSrc } from './gifHelpers';
import { parseInlineMd, normalizeSpaces } from './mdInline';

export function decodeEntities(input: string) {
  return (input || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function buildKeyNftSvg({
  bgColor,
  keyColor,
  width,
  height,
}: {
  bgColor: string;
  keyColor: string;
  width?: number;
  height?: number;
}) {
  const w = Number.isFinite(width as number)
    ? (width as number)
    : (Number.isFinite(height as number) ? (height as number) * 2 : 200);
  const h = Number.isFinite(height as number) ? (height as number) : Math.round(w / 2);
  const shaftThickness = 10;
  const ringThickness = shaftThickness;

  return `<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 200 100"
    width="${w}"
    height="${h}"
    preserveAspectRatio="xMidYMid meet"
    style="display:block; background:transparent !important; outline:none !important; filter:none !important; box-shadow:none !important;"
  >
    <rect x="0" y="0" width="200" height="100"
      style="fill:${bgColor} !important; stroke:none !important;" />
    <circle cx="60" cy="50" r="20"
      style="fill:none !important; stroke:${keyColor} !important; stroke-width:${ringThickness} !important; stroke-linecap:butt !important; stroke-linejoin:miter !important;" />
    <rect x="80" y="${50 - shaftThickness / 2}" width="100" height="${shaftThickness}" rx="${shaftThickness/2}"
      style="fill:${keyColor} !important; stroke:none !important;" />
    <path d="M145 30 A5 5 0 0 1 150 35 V46 H140 V35 A5 5 0 0 1 145 30 Z"
      style="fill:${keyColor} !important; stroke:none !important;" />
    <path d="M165 36 A5 5 0 0 1 170 41 V46 H160 V41 A5 5 0 0 1 165 36 Z"
      style="fill:${keyColor} !important; stroke:none !important;" />
  </svg>`;
}

function parseTimeToSeconds(v: string): number | undefined {
  const trimmed = (v || '').trim();
  if (!trimmed) return undefined;
  if (/^\d+:\d{1,2}$/.test(trimmed)) {
    const [m, s] = trimmed.split(':').map((x) => parseInt(x, 10));
    if (Number.isFinite(m) && Number.isFinite(s)) return m * 60 + s;
    return undefined;
  }
  const f = parseFloat(trimmed);
  return Number.isFinite(f) ? Math.max(0, f) : undefined;
}

function readAttr(token: string, key: string): string | undefined {
  const re = new RegExp(`${key}\\s*=\\s*("([^"]+)"|'([^']+)'|([^\\s>]+))`, 'i');
  const m = token.match(re);
  return m?.[2] ?? m?.[3] ?? m?.[4];
}

function splitTextIntoLinkSegments(text: string): MediaSegment[] {
  const segments: MediaSegment[] = [];
  if (!text) return segments;
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(text)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, m.index) });
    }
    segments.push({ type: 'link', label: m[1], href: m[2] });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }
  return segments.filter((s) => !(s.type === 'text' && s.content === ''));
}

function splitTextIntoHeadingAwareSegments(text: string): MediaSegment[] {
  if (!text) return [];
  const normalized = normalizeSpaces(text);
  const lines = normalized.split(/\r?\n/);
  const output: MediaSegment[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const m = line.match(/^\s{0,3}(#{1,4})[ ]+(.+)$/);
    if (m) {
      const level = Math.min(4, m[1].length) as 1 | 2 | 3 | 4;
      const inline = parseInlineMd(m[2]);
      output.push({ type: 'heading', level, inline });
    } else {
      const linky = splitTextIntoLinkSegments(line);
      linky.forEach((seg) => {
        if (seg.type === 'text') {
          const inline = parseInlineMd(seg.content);
          output.push({ type: 'formattedText', inline });
        } else {
          output.push(seg);
        }
      });
    }
    if (idx < lines.length - 1) {
      output.push({ type: 'text', content: '\n' });
    }
  }
  return output;
}

export function parseContentWithMedia(rawText: string): MediaSegment[] {
  let processedText = decodeEntities(rawText || '');
  processedText = normalizeSpaces(processedText);
  processedText = processedText
    .replace(/```(?:svg|xml|html)?\n?/gi, '')
    .replace(/```\n?/g, '');
  processedText = processedText.replace(
    /`(<(?:svg|img|music|gif|goodbye)[^`]*(?:<\/svg>|\/?>))`/gi,
    '$1'
  );
  processedText = processedText.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" />'
  );

  const segments: MediaSegment[] = [];
  let lastIndex = 0;

  const tagRegex =
    /<goodbye[^>]*\/?>|<key-nft\s+[^>]*?\/>|<chain-logo\s+[^>]*?\/>|<svg[^>]*>[\s\S]*?<\/svg>|<svg[^>]*\/>|<img[^>]*\/?>|<gif[^>]*\/?>|<music[^>]*\/?>/gi;

  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(processedText)) !== null) {
    const token = match[0];

    if (match.index > lastIndex) {
      const textBefore = processedText.slice(lastIndex, match.index);
      if (textBefore) segments.push(...splitTextIntoHeadingAwareSegments(textBefore));
    }

    const lower = token.toLowerCase();

    if (lower.startsWith('<goodbye')) {
      const wRaw = readAttr(token, 'width') ?? readAttr(token, 'w') ?? undefined;
      const hRaw = readAttr(token, 'height') ?? readAttr(token, 'h') ?? undefined;
      const sRaw = readAttr(token, 'seconds') ?? readAttr(token, 's') ?? undefined;

      const width = wRaw ? parseInt(wRaw.replace(/px$/i, ''), 10) : undefined;
      const height = hRaw ? parseInt(hRaw.replace(/px$/i, ''), 10) : undefined;
      const seconds = sRaw ? parseInt(sRaw, 10) : undefined;

      segments.push({
        type: 'goodbye',
        width: Number.isFinite(width as number) ? (width as number) : undefined,
        height: Number.isFinite(height as number) ? (height as number) : undefined,
        seconds: Number.isFinite(seconds as number) ? (seconds as number) : undefined,
      });
    } else if (lower.startsWith('<key-nft')) {
      const bg = readAttr(token, 'bgColor') ?? '#222';
      const key = readAttr(token, 'keyColor') ?? '#ffd700';
      const wRaw = readAttr(token, 'width') ?? undefined;
      const hRaw = readAttr(token, 'height') ?? undefined;
      const w = wRaw ? parseInt(wRaw.replace(/px$/i, ''), 10) : undefined;
      const h = hRaw ? parseInt(hRaw.replace(/px$/i, ''), 10) : undefined;

      const svg = buildKeyNftSvg({
        bgColor: bg,
        keyColor: key,
        width: Number.isFinite(w as number) ? (w as number) : undefined,
        height: Number.isFinite(h as number) ? (h as number) : undefined,
      });

      segments.push({ type: 'svg', content: svg });
    } else if (lower.startsWith('<chain-logo')) {
      const nameAttr =
        readAttr(token, 'chainName') ??
        readAttr(token, 'chainname') ??
        readAttr(token, 'name') ??
        '';
      const sizeStr =
        readAttr(token, 'size') ??
        readAttr(token, 'width');
      const size = sizeStr ? Number.parseInt(sizeStr, 10) : undefined;
      const chainName = nameAttr.trim();
      segments.push({ type: 'chainLogo', chainName, size });
    } else if (lower.startsWith('<svg')) {
      segments.push({ type: 'svg', content: token });
    } else if (lower.startsWith('<img')) {
      segments.push({ type: 'image', content: token });
    } else if (lower.startsWith('<gif')) {
      const srcRaw =
        readAttr(token, 'src') ??
        readAttr(token, 'url') ??
        readAttr(token, 'href') ??
        '';
      const widthRaw = readAttr(token, 'width') ?? readAttr(token, 'w') ?? undefined;
      const heightRaw = readAttr(token, 'height') ?? readAttr(token, 'h') ?? undefined;
      const alt = readAttr(token, 'alt') ?? 'GIF';

      const width = widthRaw ? parseInt(widthRaw.replace(/px$/i, ''), 10) : undefined;
      const height = heightRaw ? parseInt(heightRaw.replace(/px$/i, ''), 10) : undefined;

      const resolved = resolveGifSrc(srcRaw || '');

      if (resolved) {
        segments.push({
          type: 'gif',
          src: resolved,
          width: Number.isFinite(width as number) ? (width as number) : undefined,
          height: Number.isFinite(height as number) ? (height as number) : undefined,
          alt,
        });
      } else {
        segments.push({ type: 'text', content: token });
      }
    } else if (lower.startsWith('<music')) {
      const song = readAttr(token, 'song');
      const extRaw = readAttr(token, 'ext');
      const ext = extRaw ? extRaw.replace(/^\./, '') : undefined;

      const actionRaw = readAttr(token, 'action')?.toLowerCase();
      const action = actionRaw === 'play' || actionRaw === 'pause' || actionRaw === 'toggle'
        ? (actionRaw as 'play' | 'pause' | 'toggle')
        : undefined;

      const tAttr = readAttr(token, 'timeline') ?? readAttr(token, 'time') ?? readAttr(token, 't');
      const timeline = tAttr ? parseTimeToSeconds(tAttr) : undefined;

      const autoplayAttr = readAttr(token, 'autoplay');
      const autoplay = autoplayAttr != null
        ? !/^(false|0|no)$/i.test(autoplayAttr)
        : Boolean(song);

      segments.push({
        type: 'music',
        song: song?.trim(),
        ext,
        action,
        timeline,
        autoplay,
      });
    } else {
      segments.push(...splitTextIntoHeadingAwareSegments(token));
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < processedText.length) {
    const textAfter = processedText.slice(lastIndex);
    if (textAfter) segments.push(...splitTextIntoHeadingAwareSegments(textAfter));
  }

  if (segments.length === 0) segments.push(...splitTextIntoHeadingAwareSegments(processedText));

  return segments;
}
