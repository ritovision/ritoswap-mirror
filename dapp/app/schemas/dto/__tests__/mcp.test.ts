import {
  ContentItemSchema,
  ToolWireSchema,
  ListToolsResultSchema,
  CallToolResultSchema,
  MCPSuccessSchema,
  MCPErrorSchema,
  MCPRequestSchema,
} from '../mcp';

describe('MCP DTO schemas', () => {
  it('ContentItemSchema validates basic shapes', () => {
    expect(() =>
      ContentItemSchema.parse({ type: 'text', text: 'hello' }),
    ).not.toThrow();

    expect(() =>
      ContentItemSchema.parse({ type: 'json', data: { ok: true } }),
    ).not.toThrow();

    expect(() =>
      ContentItemSchema.parse({ text: 'missing type' } as any),
    ).toThrow();

    expect(() =>
      ContentItemSchema.parse({ type: 123 } as any),
    ).toThrow();
  });

  it('ToolWireSchema allows optional description and requires inputSchema object', () => {
    expect(() =>
      ToolWireSchema.parse({
        name: 'echo',
        inputSchema: { type: 'object', properties: { text: { type: 'string' } } },
      }),
    ).not.toThrow();

    expect(() =>
      ToolWireSchema.parse({
        name: 'echo',
        description: 'Echo text',
        inputSchema: {},
      }),
    ).not.toThrow();

    // Rejects when inputSchema isn't a record-like object
    expect(() =>
      ToolWireSchema.parse({
        name: 'bad',
        inputSchema: null,
      } as any),
    ).toThrow();
  });

  it('ListToolsResultSchema wraps an array of ToolWire', () => {
    const value = {
      tools: [
        { name: 't1', inputSchema: {} },
        { name: 't2', description: 'desc', inputSchema: { type: 'object' } },
      ],
    };
    expect(() => ListToolsResultSchema.parse(value)).not.toThrow();

    expect(() => ListToolsResultSchema.parse({ tools: [{}] } as any)).toThrow();
  });

  it('CallToolResultSchema requires content array and optional isError', () => {
    expect(() =>
      CallToolResultSchema.parse({
        content: [{ type: 'text', text: 'ok' }],
      }),
    ).not.toThrow();

    expect(() =>
      CallToolResultSchema.parse({
        content: [{ type: 'json', data: { a: 1 } }],
        isError: true,
      }),
    ).not.toThrow();

    expect(() =>
      CallToolResultSchema.parse({ content: [] } as any),
    ).not.toThrow(); // empty array still valid

    expect(() =>
      CallToolResultSchema.parse({ isError: false } as any),
    ).toThrow();
  });

  it('MCPSuccessSchema accepts either list-tools or call-tool success payloads', () => {
    const list = { tools: [{ name: 'x', inputSchema: {} }] };
    const call = { content: [{ type: 'text', text: 'hi' }] };

    expect(() => MCPSuccessSchema.parse(list)).not.toThrow();
    expect(() => MCPSuccessSchema.parse(call)).not.toThrow();

    expect(() => MCPSuccessSchema.parse({} as any)).toThrow();
  });

  it('MCPErrorSchema validates error envelope', () => {
    expect(() =>
      MCPErrorSchema.parse({
        error: { code: 400, message: 'bad', data: { x: 1 } },
      }),
    ).not.toThrow();

    expect(() =>
      MCPErrorSchema.parse({ error: { message: 'missing code' } } as any),
    ).toThrow();
  });

  describe('MCPRequestSchema (discriminated by method)', () => {
    it('tools/list: params optional; extra keys are stripped (not thrown)', () => {
      // No params
      expect(() =>
        MCPRequestSchema.parse({ method: 'tools/list' }),
      ).not.toThrow();

      // Empty params object is fine
      expect(() =>
        MCPRequestSchema.parse({ method: 'tools/list', params: {} }),
      ).not.toThrow();

      // Extra keys are accepted but STRIPPED by Zod’s default unknownKeys behavior
      const parsed = MCPRequestSchema.parse({
        method: 'tools/list',
        params: { x: 1, y: 'z' },
      } as any);
      expect(parsed).toEqual({ method: 'tools/list', params: {} });
    });

    it('tools/call: requires params with name; arguments optional record', () => {
      expect(() =>
        MCPRequestSchema.parse({
          method: 'tools/call',
          params: { name: 'echo', arguments: { text: 'hi' } },
        }),
      ).not.toThrow();

      expect(() =>
        MCPRequestSchema.parse({
          method: 'tools/call',
          params: { name: 'echo' },
        }),
      ).not.toThrow();

      expect(() =>
        MCPRequestSchema.parse({
          method: 'tools/call',
          params: { arguments: {} },
        } as any),
      ).toThrow(); // missing name

      expect(() =>
        MCPRequestSchema.parse({
          method: 'tools/call',
        } as any),
      ).toThrow(); // missing params
    });

    it('rejects unknown method', () => {
      expect(() =>
        MCPRequestSchema.parse({ method: 'tools/unknown', params: {} } as any),
      ).toThrow();
    });
  });
});
