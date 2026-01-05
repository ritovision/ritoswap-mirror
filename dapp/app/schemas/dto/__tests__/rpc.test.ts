import {
  RPCIdSchema,
  RPCRequestSchema,
  RPCErrorObjectSchema,
  RPCResponseSchema,
} from '../rpc';

describe('RPC DTO schemas', () => {
  it('RPCIdSchema accepts string or number', () => {
    expect(() => RPCIdSchema.parse('1')).not.toThrow();
    expect(() => RPCIdSchema.parse(42)).not.toThrow();
    expect(() => RPCIdSchema.parse(null as any)).toThrow();
  });

  it('RPCRequestSchema validates request shape', () => {
    expect(() =>
      RPCRequestSchema.parse({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      }),
    ).not.toThrow();

    expect(() =>
      RPCRequestSchema.parse({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{}],
        id: 'abc',
      }),
    ).not.toThrow();

    expect(() =>
      RPCRequestSchema.parse({
        jsonrpc: '2.1', // wrong version
        method: 'eth_call',
        params: [],
        id: 1,
      }),
    ).toThrow();

    expect(() =>
      RPCRequestSchema.parse({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: {}, // must be array
        id: 1,
      } as any),
    ).toThrow();
  });

  it('RPCErrorObjectSchema validates error object', () => {
    expect(() =>
      RPCErrorObjectSchema.parse({ code: -32000, message: 'execution reverted' }),
    ).not.toThrow();
    expect(() =>
      RPCErrorObjectSchema.parse({ code: -1, message: 'err', data: { foo: 'bar' } }),
    ).not.toThrow();

    expect(() =>
      RPCErrorObjectSchema.parse({ message: 'missing code' } as any),
    ).toThrow();
  });

  it('RPCResponseSchema validates result or error responses', () => {
    // result-only
    expect(() =>
      RPCResponseSchema.parse({
        jsonrpc: '2.0',
        id: 1,
        result: '0x1',
      }),
    ).not.toThrow();

    // error-only
    expect(() =>
      RPCResponseSchema.parse({
        jsonrpc: '2.0',
        id: 'abc',
        error: { code: -32000, message: 'oops' },
      }),
    ).not.toThrow();

    // both present (schema currently allows it)
    expect(() =>
      RPCResponseSchema.parse({
        jsonrpc: '2.0',
        id: 2,
        result: null,
        error: { code: 1, message: 'warn' },
      }),
    ).not.toThrow();

    // neither result nor error (schema currently allows; this test codifies that)
    expect(() =>
      RPCResponseSchema.parse({
        jsonrpc: '2.0',
        id: 3,
      }),
    ).not.toThrow();
  });
});
