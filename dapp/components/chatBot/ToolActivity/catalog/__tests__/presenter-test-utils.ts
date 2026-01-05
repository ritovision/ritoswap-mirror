// Shared test utilities for presenter tests

// Normalize ToolChipContent (string | {label?, text?})
export function normalizeContent(c: unknown): { label?: string; text?: string } {
  if (typeof c === 'string') return { label: '', text: c };
  if (c && typeof c === 'object') {
    const obj = c as { label?: string; text?: string };
    return { label: obj.label, text: obj.text };
  }
  return { label: '', text: '' };
}

export type Chip = {
  input?: unknown;
  output?: unknown;
  errorText?: string;
};
