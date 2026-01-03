import type { Tool } from '../tool';
import type { CallToolResult } from '../../dto/mcp';

describe('Tool<TParams> typing', () => {
  it('enforces parameter and return types with expectTypeOf', () => {
    type Params = { a: number; b?: string };

    const myTool: Tool<Params> = {
      name: 'add_numbers',
      description: 'adds a + Number(b)',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'string' },
        },
        required: ['a'],
        additionalProperties: false,
      },
      requiresJwt: true,
      handler: async (p) => {
        // compile-time check: p.a is number, p.b is optional string
        const sum = p.a + (p.b ? Number(p.b) : 0);
        // We don’t assert shape at runtime here; we only need to satisfy types.
        return { ok: true, content: String(sum) } as unknown as CallToolResult;
      },
    };

    // Type-level expectations
    expectTypeOf(myTool).toMatchTypeOf<Tool<Params>>();
    expectTypeOf(myTool.handler).parameter(0).toMatchTypeOf<Params>();
    expectTypeOf(myTool.handler).returns.resolves.toMatchTypeOf<CallToolResult>();

    // A tiny runtime sanity check: handler returns a Promise-like
    const resPromise = myTool.handler({ a: 2, b: '3' });
    expect(typeof (resPromise as any)?.then).toBe('function');
  });

  it('requiresJwt is optional', () => {
    type P = { x: string };
    const minimal: Tool<P> = {
      name: 'echo_x',
      description: 'echoes x',
      inputSchema: { type: 'object' },
      handler: async (_p) => ({ ok: true, content: 'ok' } as unknown as CallToolResult),
    };
    expectTypeOf(minimal).toMatchTypeOf<Tool<P>>();
  });
});
