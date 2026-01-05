// dapp/components/utilities/chatBot/ChatMessages/utils/mdInline.ts
/**
 * mdInline.ts
 * - Normalizes "weird" spaces (\ , &nbsp;, NBSP unicode) to plain spaces.
 * - Parses simple inline markdown for **bold** and *italic* (also __, _).
 * - Respects escaped markers: \*, \_, \#, \\ -> literal, not formatting.
 *
 * NOTE: Links are handled elsewhere; this only handles emphasis.
 */

export type InlineRun = { type: 'text' | 'strong' | 'em'; content: string };

/** Normalize escaped space-ish + NBSP to plain spaces. */
export function normalizeSpaces(input: string): string {
  if (!input) return '';
  let s = input;

  // HTML entities → space
  s = s.replace(/&nbsp;|&#160;|&#xA0;/gi, ' ');

  // NBSP and other common unicode space lookalikes → space
  s = s.replace(/[\u00A0\u2007\u202F]/g, ' ');

  // Backslash-space (markdown hard break) or backslash-tab/newline -> single space
  s = s.replace(/\\[ \t\r\n]/g, ' ');

  return s;
}

/** Unescape escaped markdown markers so they render literally. */
function unescapeMarkers(input: string): string {
  return input
    .replace(/\\\*/g, '*')
    .replace(/\\_/g, '_')
    .replace(/\\#/g, '#')
    .replace(/\\\\/g, '\\');
}

/**
 * Parse **bold** / __bold__ and *italic* / _italic_.
 * Very small, non-greedy scanner; does not try to be a full CommonMark impl.
 * Handles nested in the simple, common case by preferring bold before italic.
 */
export function parseInlineMd(raw: string): InlineRun[] {
  if (!raw) return [];
  let s = normalizeSpaces(raw);
  s = unescapeMarkers(s);

  const runs: InlineRun[] = [];
  let i = 0;

  const pushText = (txt: string) => {
    if (!txt) return;
    runs.push({ type: 'text', content: txt });
  };

  while (i < s.length) {
    // Bold **...** or __...__
    const boldStart = s.slice(i).match(/^(\*\*|__)/);
    if (boldStart) {
      const marker = boldStart[1];
      const start = i + marker.length;
      const end = s.indexOf(marker, start);
      if (end !== -1) {
        runs.push({ type: 'strong', content: s.slice(start, end) });
        i = end + marker.length;
        continue;
      }
      // No closing marker found - treat as literal text and advance past it
      pushText(marker);
      i += marker.length;
      continue;
    }

    // Italic *...* or _..._
    const italStart = s.slice(i).match(/^(\*|_)/);
    if (italStart) {
      const marker = italStart[1];
      const start = i + marker.length;
      const end = s.indexOf(marker, start);
      if (end !== -1) {
        runs.push({ type: 'em', content: s.slice(start, end) });
        i = end + marker.length;
        continue;
      }
      // No closing marker found - treat as literal text and advance past it
      pushText(marker);
      i += marker.length;
      continue;
    }

    // No marker here — advance to next potential marker quickly
    const next = s.slice(i).search(/(\*\*|__|\*|_)/);
    if (next === -1) {
      pushText(s.slice(i));
      break;
    } else if (next === 0) {
      // Safety check: if we found a marker at position 0 but didn't handle it above,
      // something went wrong. Advance by 1 to prevent infinite loop.
      pushText(s[i]);
      i += 1;
    } else {
      pushText(s.slice(i, i + next));
      i += next;
    }
  }

  return runs;
}