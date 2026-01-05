export class ToolFailure extends Error {
  public readonly isToolFailure = true;
  constructor(message: string) {
    super(message);
    this.name = 'ToolFailure';
  }
}

/**
 * Throw when a tool must abort and be reported as an error.
 * Usage: if (!owner) fail('Not signed in');
 */
export function fail(message: string): never {
  throw new ToolFailure(message);
}

/**
 * Convenience: produce a structured result object (if you prefer returning instead of throwing).
 */
export function errorResultShape(message: string) {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}
