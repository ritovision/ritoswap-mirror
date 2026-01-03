
// Hoisted state & spies
const h = vi.hoisted(() => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  // use any to avoid TS casts from possibly-string enum → number
  activeChain: 0 as any,
  getRpcUrl: vi.fn(() => 'http://rpc-url'),
  // viem shims
  encodeFunctionData: vi.fn(() => '0xabc'),
  decodeFunctionResult: vi.fn(() => '0xdec0ded'),
  encodeEventTopics: vi.fn(() => ['0xtopic']),
  isHex: vi.fn((x: any) => typeof x === 'string' && /^0x[0-9a-fA-F]*$/.test(x)),
  // rpc bridge
  callRPC: vi.fn(),
}));

vi.mock('@logger', () => ({
  createLogger: () => h.logger,
}));

// Mock chain config/enum used by contracts.ts
vi.mock('@config/chain', () => {
  enum Chain {
    ETHEREUM = 0,
    SEPOLIA = 1,
    RITONET  = 2,
  }
  return {
    Chain,
    getActiveChain: () => h.activeChain as any,
  };
});

// IMPORTANT: contracts.ts imports '../chains' and '../rpc' relative to this test file
vi.mock('../chains', () => ({
  getRpcUrl: h.getRpcUrl,
}));

vi.mock('../rpc', () => ({
  callRPC: h.callRPC,
}));

vi.mock('viem', () => ({
  encodeFunctionData: h.encodeFunctionData,
  decodeFunctionResult: h.decodeFunctionResult,
  encodeEventTopics: h.encodeEventTopics,
  isHex: h.isHex,
}));

// Import after mocks are set
import {
  resolveActiveSupportedChain,
  getActiveRpcUrl,
  callContract,
  getBlockNumber,
  getEventLogsChunked,
} from '../contracts';
import { Chain } from '@config/chain';

describe('contracts.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.activeChain = Chain.ETHEREUM as any;
    h.getRpcUrl.mockReturnValue('http://rpc-url');
  });

  it('resolveActiveSupportedChain maps Chain → SupportedChain', () => {
    h.activeChain = Chain.ETHEREUM as any;
    expect(resolveActiveSupportedChain()).toBe('mainnet');

    h.activeChain = Chain.SEPOLIA as any;
    expect(resolveActiveSupportedChain()).toBe('sepolia');

    h.activeChain = Chain.RITONET as any;
    expect(resolveActiveSupportedChain()).toBe('ritonet');
  });

  it('getActiveRpcUrl uses resolve chain + getRpcUrl and logs', () => {
    h.activeChain = Chain.SEPOLIA as any;
    h.getRpcUrl.mockReturnValue('http://sep');

    const url = getActiveRpcUrl();
    expect(url).toBe('http://sep');
    expect(h.logger.debug).toHaveBeenCalledWith('Active RPC URL', {
      chain: 'sepolia',
      url: 'http://sep',
    });
  });

  it('callContract: encodes call, delegates to RPC, decodes result', async () => {
    h.callRPC.mockResolvedValue('0xdeadbeef');
    h.isHex.mockImplementation((x: any) => /^0x/.test(String(x))); // allow hex

    const out = await callContract<string>({
      abi: [] as any,
      address: ('0x' + 'a'.repeat(40)) as any,
      functionName: 'balanceOf',
      args: [('0x' + 'b'.repeat(40)) as any],
    });

    expect(h.encodeFunctionData).toHaveBeenCalledWith({
      abi: [],
      functionName: 'balanceOf',
      args: [expect.any(String)],
    });
    expect(h.callRPC).toHaveBeenCalledWith(
      'http://rpc-url',
      'eth_call',
      [expect.objectContaining({ to: expect.any(String), data: '0xabc' }), 'latest'],
    );
    expect(h.decodeFunctionResult).toHaveBeenCalledWith({
      abi: [],
      functionName: 'balanceOf',
      data: '0xdeadbeef',
    });
    expect(out).toBe('0xdec0ded');
  });

  it('callContract: throws if result is not hex', async () => {
    h.callRPC.mockResolvedValue('not-hex');
    h.isHex.mockReturnValue(false as any);

    await expect(
      callContract<any>({
        abi: [] as any,
        address: ('0x' + 'a'.repeat(40)) as any,
        functionName: 'symbol',
      }),
    ).rejects.toThrow(/Invalid eth_call result/);
  });

  it('getBlockNumber returns bigint and validates hex', async () => {
    h.callRPC.mockResolvedValue('0x10'); // 16
    h.isHex.mockReturnValue(true as any);

    const bn = await getBlockNumber();
    expect(bn).toBe(16n);
  });

  it('getBlockNumber throws for non-hex response', async () => {
    h.callRPC.mockResolvedValue(123 as any);
    h.isHex.mockReturnValue(false as any);

    await expect(getBlockNumber()).rejects.toThrow(/Invalid block number/);
  });

  it('getEventLogsChunked iterates by chunk and encodes topic', async () => {
    h.getRpcUrl.mockReturnValue('http://rpc');
    h.encodeEventTopics.mockReturnValue(['0xtopic']);

    // two chunks: [100..199], [200..250]
    h.callRPC
      .mockResolvedValueOnce([
        { data: '0x1', topics: [], blockNumber: '0x64', transactionHash: '0xaaa' },
      ])
      .mockResolvedValueOnce([
        { data: '0x2', topics: [], blockNumber: '0xc8', transactionHash: '0xbbb' },
      ]);

    const chunks: any[] = [];
    for await (const logs of getEventLogsChunked({
      address: ('0x' + '1'.repeat(40)) as any,
      abi: [] as any,
      eventName: 'Transfer',
      fromBlock: 100n,
      toBlock: 250n,
      chunkSize: 100n,
    })) {
      chunks.push(logs);
    }

    expect(h.encodeEventTopics).toHaveBeenCalledWith({ abi: [], eventName: 'Transfer' });
    expect(chunks.length).toBe(2);
    expect(chunks[0][0].data).toBe('0x1');
    expect(chunks[1][0].data).toBe('0x2');

    // verify RPC calls used correct range hex
    const firstFilter = h.callRPC.mock.calls[0][2][0];
    const secondFilter = h.callRPC.mock.calls[1][2][0];
    expect(firstFilter).toMatchObject({ fromBlock: '0x64', toBlock: '0xc7' }); // 100..199
    expect(secondFilter).toMatchObject({ fromBlock: '0xc8', toBlock: '0xfa' }); // 200..250
  });

  it('getEventLogsChunked throws if topic encoding fails', async () => {
    h.encodeEventTopics.mockReturnValue([]);

    await expect(async () => {
      const it = getEventLogsChunked({
        address: ('0x' + '1'.repeat(40)) as any,
        abi: [] as any,
        eventName: 'X',
        fromBlock: 0n,
        toBlock: 0n,
      });
      // consume one step to trigger
      for await (const _ of it) { /* no-op */ }
    }).rejects.toThrow(/Unable to encode topic/);
  });
});
