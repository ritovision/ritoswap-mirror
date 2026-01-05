import type { InlineRun, MediaSegment } from '../types';
import { parseContentWithMedia } from './parseContentWithMedia';
import { normalizeSpaces } from './mdInline';

function inlineRunsToText(runs: InlineRun[]): string {
  return runs.map((r) => r.content).join('');
}

function segmentToText(segment: MediaSegment): string {
  switch (segment.type) {
    case 'text':
      return segment.content;
    case 'formattedText':
      return inlineRunsToText(segment.inline);
    case 'heading':
      return inlineRunsToText(segment.inline);
    case 'link':
      return segment.label;
    default:
      return '';
  }
}

export function extractSpeakableText(rawText: string): string {
  if (!rawText) return '';
  const segments = parseContentWithMedia(rawText);
  const combined = segments.map(segmentToText).filter(Boolean).join(' ');
  return normalizeSpaces(combined).replace(/\s+/g, ' ').trim();
}
