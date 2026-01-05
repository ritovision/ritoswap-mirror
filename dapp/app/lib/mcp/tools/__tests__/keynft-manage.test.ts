// dapp/app/lib/mcp/tools/__tests__/keynft-manage.test.ts

export {};

// Mock logger
vi.mock('@logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock chain config - MUST include Chain and getActiveChain for contracts module
vi.mock('@config/chain', () => ({
  Chain: {
    ETHEREUM: 'ethereum',
    SEPOLIA: 'sepolia',
    RITONET: 'ritonet',
  },
  getActiveChain: vi.fn(() => 'sepolia'),
  getChainConfig: vi.fn(() => ({
    rpcUrl: 'http://localhost:8545',
    chainId: 11155111,
    explorerUrl: 'https://sepolia.etherscan.io',
  })),
}));

// Mock config
vi.mock('@config/ai.server', () => ({
  aiServerConfig: {
    secrets: { aiPrivateKey: undefined },
  },
}));

vi.mock('@config/contracts', () => ({
  KEY_TOKEN_ADDRESS: '0xKeyTokenContract1234567890123456789012',
  fullKeyTokenAbi: [],
}));

// Mock contract calls
const mockCallContract = vi.fn();
// IMPORTANT: correct relative path from this test to the utils module
vi.mock('../../utils/contracts', () => ({
  callContract: mockCallContract,
}));

// Viem mocks
const mockWriteContract = vi.fn();
const mockWaitForTransactionReceipt = vi.fn();

vi.mock('viem', () => ({
  createWalletClient: vi.fn(() => ({
    writeContract: mockWriteContract,
  })),
  createPublicClient: vi.fn(() => ({
    waitForTransactionReceipt: mockWaitForTransactionReceipt,
  })),
  http: vi.fn((url: string) => url),
}));

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn(() => ({
    address: '0xBotSigner123456789012345678901234567890',
  })),
}));

describe('keynft-manage tool', () => {
  let keynftManageTool: any;
  let aiServerConfig: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Default successful setup
    aiServerConfig = await import('@config/ai.server').then(m => m.aiServerConfig);
    (aiServerConfig as any).secrets.aiPrivateKey = '0xPrivateKey';

    mockCallContract.mockResolvedValue([123n, true]); // getTokenOfOwner: has token
    mockWriteContract.mockResolvedValue('0xTxHash123');
    mockWaitForTransactionReceipt.mockResolvedValue({
      status: 'success',
      blockNumber: 12345n,
    });

    keynftManageTool = await import('../keynft-manage').then(m => m.default);
  });

  describe('configuration checks', () => {
    it('returns error when AI_PRIVATE_KEY is not configured', async () => {
      (aiServerConfig as any).secrets.aiPrivateKey = undefined;

      const result = await keynftManageTool.handler({ action: 'query' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('AI_PRIVATE_KEY not configured');
    });
  });

  describe('query action', () => {
    it('returns token info when token exists', async () => {
      mockCallContract
        .mockResolvedValueOnce([456n, true]) // getTokenOfOwner
        .mockResolvedValueOnce(['#FF0000', '#00FF00']); // getTokenColors

      const result = await keynftManageTool.handler({ action: 'query' });

      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(2);

      const textContent = result.content.find((c: any) => c.type === 'text');
      const jsonContent = result.content.find((c: any) => c.type === 'json');

      expect(textContent.text).toContain('token #456');
      expect(jsonContent.data).toMatchObject({
        hasToken: true,
        tokenId: '456',
        colors: {
          backgroundColor: '#FF0000',
          keyColor: '#00FF00',
        },
      });
    });

    it('returns no token message when token does not exist', async () => {
      mockCallContract.mockResolvedValueOnce([0n, false]); // no token

      const result = await keynftManageTool.handler({ action: 'query' });

      expect(result.isError).toBeUndefined();
      const textContent = result.content.find((c: any) => c.type === 'text');
      const jsonContent = result.content.find((c: any) => c.type === 'json');

      expect(textContent.text).toContain('No Key NFT found');
      expect(jsonContent.data.hasToken).toBe(false);
    });

    it('falls back to tokensOfOwner when getTokenOfOwner fails', async () => {
      mockCallContract
        .mockRejectedValueOnce(new Error('Method not found'))
        .mockResolvedValueOnce([789n]) // tokensOfOwner
        .mockResolvedValueOnce(['#0000FF', '#FFFF00']); // getTokenColors

      const result = await keynftManageTool.handler({ action: 'query' });

      expect(result.isError).toBeUndefined();
      const jsonContent = result.content.find((c: any) => c.type === 'json');
      expect(jsonContent.data.tokenId).toBe('789');
    });

    it('handles missing colors gracefully', async () => {
      mockCallContract
        .mockResolvedValueOnce([111n, true]) // has token
        .mockRejectedValueOnce(new Error('Colors not implemented')); // no colors

      const result = await keynftManageTool.handler({ action: 'query' });

      expect(result.isError).toBeUndefined();
      const jsonContent = result.content.find((c: any) => c.type === 'json');
      expect(jsonContent.data.colors).toEqual({});
    });
  });

  describe('burn action', () => {
    it('burns existing token', async () => {
      mockCallContract.mockResolvedValueOnce([222n, true]); // has token

      const result = await keynftManageTool.handler({ action: 'burn' });

      expect(mockWriteContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'burn',
          args: [222n],
        })
      );

      expect(result.isError).toBeUndefined();
      const jsonContent = result.content.find((c: any) => c.type === 'json');
      expect(jsonContent.data.action).toBe('burn');
      expect(jsonContent.data.burnedTokenId).toBe('222');
      expect(jsonContent.data.burn.hash).toBe('0xTxHash123');
    });

    it('returns message when no token to burn', async () => {
      mockCallContract.mockResolvedValueOnce([0n, false]); // no token

      const result = await keynftManageTool.handler({ action: 'burn' });

      expect(mockWriteContract).not.toHaveBeenCalled();
      expect(result.isError).toBeUndefined();

      const textContent = result.content.find((c: any) => c.type === 'text');
      expect(textContent.text).toContain('No Key NFT to burn');
    });

    it('includes explorer URL in burn result', async () => {
      mockCallContract.mockResolvedValueOnce([333n, true]);

      const result = await keynftManageTool.handler({ action: 'burn' });

      const jsonContent = result.content.find((c: any) => c.type === 'json');
      expect(jsonContent.data.burn.url).toContain('sepolia.etherscan.io');
      expect(jsonContent.data.burn.url).toContain('0xTxHash123');
    });

    it('includes timeline events', async () => {
      mockCallContract.mockResolvedValueOnce([444n, true]);

      const result = await keynftManageTool.handler({ action: 'burn' });

      const jsonContent = result.content.find((c: any) => c.type === 'json');
      expect(jsonContent.data.timeline).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ phase: 'query' }),
          expect.objectContaining({ phase: 'burn' }),
          expect.objectContaining({ phase: 'result' }),
        ])
      );
    });
  });

  describe('mint action', () => {
    it('mints new token when no existing token', async () => {
      mockCallContract
        .mockResolvedValueOnce([0n, false]) // no existing token
        .mockResolvedValueOnce([555n, true]) // new token after mint
        .mockResolvedValueOnce(['#AAAAAA', '#BBBBBB']); // colors

      const result = await keynftManageTool.handler({ action: 'mint' });

      expect(mockWriteContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'mint',
          args: [],
        })
      );
      expect(mockWriteContract).toHaveBeenCalledTimes(1); // no burn

      const jsonContent = result.content.find((c: any) => c.type === 'json');
      expect(jsonContent.data.action).toBe('mint');
      expect(jsonContent.data.tokenId).toBe('555');
      expect(jsonContent.data.burnedTokenId).toBeUndefined();
    });

    it('burns existing token before minting', async () => {
      mockCallContract
        .mockResolvedValueOnce([666n, true]) // existing token
        .mockResolvedValueOnce([777n, true]) // new token after mint
        .mockResolvedValueOnce(['#CCCCCC', '#DDDDDD']); // colors

      const result = await keynftManageTool.handler({ action: 'mint' });

      expect(mockWriteContract).toHaveBeenCalledTimes(2);
      expect(mockWriteContract).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          functionName: 'burn',
          args: [666n],
        })
      );
      expect(mockWriteContract).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          functionName: 'mint',
          args: [],
        })
      );

      const jsonContent = result.content.find((c: any) => c.type === 'json');
      expect(jsonContent.data.burnedTokenId).toBe('666');
      expect(jsonContent.data.tokenId).toBe('777');
    });

    it('includes both burn and mint transaction details', async () => {
      mockCallContract
        .mockResolvedValueOnce([888n, true]) // existing
        .mockResolvedValueOnce([999n, true]) // new token
        .mockResolvedValueOnce(['#EEEEEE', '#FFFFFF']);

      mockWriteContract
        .mockResolvedValueOnce('0xBurnHash')
        .mockResolvedValueOnce('0xMintHash');

      const result = await keynftManageTool.handler({ action: 'mint' });

      const jsonContent = result.content.find((c: any) => c.type === 'json');
      expect(jsonContent.data.burn.hash).toBe('0xBurnHash');
      expect(jsonContent.data.mint.hash).toBe('0xMintHash');
    });

    it('includes colors in mint result', async () => {
      mockCallContract
        .mockResolvedValueOnce([0n, false])
        .mockResolvedValueOnce([123n, true])
        .mockResolvedValueOnce(['#123456', '#789ABC']);

      const result = await keynftManageTool.handler({ action: 'mint' });

      const jsonContent = result.content.find((c: any) => c.type === 'json');
      expect(jsonContent.data.colors).toEqual({
        backgroundColor: '#123456',
        keyColor: '#789ABC',
      });
    });

    it('handles case when token not detected after mint', async () => {
      mockCallContract
        .mockResolvedValueOnce([0n, false]) // no existing
        .mockResolvedValueOnce([0n, false]); // still no token after mint (unlikely)

      const result = await keynftManageTool.handler({ action: 'mint' });

      expect(result.isError).toBeUndefined();
      const jsonContent = result.content.find((c: any) => c.type === 'json');
      expect(jsonContent.data.tokenId).toBeUndefined();
      expect(jsonContent.data.timeline).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('not detected on re-query'),
          }),
        ])
      );
    });
  });

  describe('error handling', () => {
    it('returns error when contract read fails', async () => {
      mockCallContract.mockRejectedValue(new Error('RPC error'));

      const result = await keynftManageTool.handler({ action: 'query' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('RPC error');
    });

    it('returns error when burn transaction fails', async () => {
      mockCallContract.mockResolvedValueOnce([111n, true]);
      mockWriteContract.mockRejectedValue(new Error('Transaction reverted'));

      const result = await keynftManageTool.handler({ action: 'burn' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Transaction reverted');
    });

    it('returns error when mint transaction fails', async () => {
      mockCallContract.mockResolvedValueOnce([0n, false]);
      mockWriteContract.mockRejectedValue(new Error('Gas estimation failed'));

      const result = await keynftManageTool.handler({ action: 'mint' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Gas estimation failed');
    });

    it('handles non-Error exceptions', async () => {
      mockCallContract.mockRejectedValue('String error');

      const result = await keynftManageTool.handler({ action: 'query' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Key NFT manage failed');
    });
  });

  describe('tool metadata', () => {
    it('has correct tool name', () => {
      expect(keynftManageTool.tool.name).toBe('manage_key_nft');
    });

    it('requires JWT', () => {
      expect(keynftManageTool.requiresJwt).toBe(true);
    });

    it('has valid input schema', () => {
      expect(keynftManageTool.tool.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['mint', 'burn', 'query'],
          },
        },
        required: ['action'],
        additionalProperties: false,
      });
    });

    it('has appropriate description', () => {
      expect(keynftManageTool.tool.description).toContain('Key NFT');
      expect(keynftManageTool.tool.description).toContain('chatbot signer');
    });
  });

  describe('explorer URL handling', () => {
    it('includes explorer URL when available', async () => {
      mockCallContract.mockResolvedValueOnce([222n, true]);

      const result = await keynftManageTool.handler({ action: 'burn' });

      const jsonContent = result.content.find((c: any) => c.type === 'json');
      expect(jsonContent.data.burn.url).toBeTruthy();
      expect(jsonContent.data.burn.url).toContain('/tx/');
    });

    it('handles missing explorer URL gracefully', async () => {
      const { getChainConfig } = await import('@config/chain');
      (getChainConfig as any).mockReturnValue({
        rpcUrl: 'http://localhost:8545',
        chainId: 90999999,
        explorerUrl: undefined,
      });

      mockCallContract.mockResolvedValueOnce([333n, true]);

      const result = await keynftManageTool.handler({ action: 'burn' });

      const jsonContent = result.content.find((c: any) => c.type === 'json');
      expect(jsonContent.data.burn.url).toBeUndefined();
    });
  });
});
