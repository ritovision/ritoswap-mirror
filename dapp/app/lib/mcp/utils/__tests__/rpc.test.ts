
const h = vi.hoisted(() => ({
  logger: { debug: vi.fn(), error: vi.fn() },
  // passthrough "schema" so we control the shape entirely in tests
  RPCResponseSchema: {
    parse: (data: any) => data,
  },
}));

vi.mock('@logger', () => ({
  createLogger: () => h.logger,
}));

vi.mock('@schemas/dto/rpc', () => ({
  RPCResponseSchema: h.RPCResponseSchema,
}));

import { callRPC, getBalance, formatEther } from '../rpc';

describe('rpc.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    (globalThis as any).fetch = vi.fn();
  });

  it('callRPC success', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ jsonrpc: '2.0', id: 'rpc-1', result: '0xdeadbeef' }),
    });

    const res = await callRPC('http://rpc', 'eth_chainId', []);
    expect(res).toBe('0xdeadbeef');
    expect(h.logger.debug).toHaveBeenCalledWith('RPC success', expect.any(Object));
  });

  it('callRPC HTTP non-ok throws', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Boom',
      json: async () => ({}),
    });

    await expect(callRPC('http://rpc', 'eth_chainId', [])).rejects.toThrow(
      /RPC request failed: 500 Boom/
    );
    expect(h.logger.error).toHaveBeenCalledWith('RPC call failed', expect.any(Object));
  });

  it('callRPC JSON-RPC error object throws', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        jsonrpc: '2.0',
        id: 'rpc-2',
        error: { code: -32000, message: 'bad' },
      }),
    });

    await expect(callRPC('http://rpc', 'eth_call', [])).rejects.toThrow(
      /RPC error -32000: bad/
    );
    expect(h.logger.error).toHaveBeenCalledWith('RPC error', expect.any(Object));
  });

  it('callRPC timeout aborts and throws (simulate AbortError)', async () => {
    // Directly make fetch reject with an AbortError. This avoids timer/abort races.
    (globalThis.fetch as any).mockImplementation(() => {
      const err = new Error('Aborted');
      (err as any).name = 'AbortError';
      return Promise.reject(err);
    });

    await expect(
      callRPC('http://rpc', 'eth_blockNumber', [], { timeout: 1000 })
    ).rejects.toThrow(/timeout after 1000ms/);

    // Ensure correct logging path hit
    expect(h.logger.error).toHaveBeenCalledWith('RPC timeout', expect.any(Object));
  });

  it('getBalance happy', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: '2.0', id: 'rpc-3', result: '0x1' }),
    });
    const v = await getBalance('http://rpc', '0xabc');
    expect(v).toBe(1n);
  });

  it('getBalance invalid result type throws', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: '2.0', id: 'rpc-4', result: 123 }),
    });
    await expect(getBalance('http://rpc', '0xabc')).rejects.toThrow(/Invalid balance response/);
  });

  it('formatEther formatting', () => {
    // 1 ETH
    expect(formatEther(1000000000000000000n)).toBe('1');
    // 1.2345 ETH
    expect(formatEther(1234500000000000000n, 4)).toBe('1.2345');
    // trim trailing zeros
    expect(formatEther(1200000000000000000n, 6)).toBe('1.2');
    // large number
    expect(formatEther(987654321000000000000000n, 3)).toBe('987654.321');
  });
});
