// app/lib/llm/utils.ts
export function asArray<T = unknown>(x: unknown): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}

export function isString(x: unknown): x is string {
  return typeof x === 'string';
}

export function safeJson(o: unknown, max = 2000): string {
  try {
    const s = JSON.stringify(o, null, 2);
    return s.length > max ? s.slice(0, max) + '…(trunc)' : s;
  } catch {
    return String(o);
  }
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}