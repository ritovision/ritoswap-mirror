// dapp/app/lib/mcp/tools/__tests__/send-crypto.test.ts
import { fail } from '../tool-errors';

// Mock modules before imports
vi.mock('@logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@config/ai.server', () => ({
  aiServerConfig: {
    secrets: { aiPrivateKey: undefined },
  },
}));

vi.mock('@config/public.env', () => ({
  publicEnv: {
    NEXT_PUBLIC_LOCAL_CHAIN_ID: 90999999,
    NEXT_PUBLIC_LOCAL_BLOCKCHAIN_EXPLORER_URL: 'http://localhost:4000',
  },
}));

vi.mock('@config/chain', () => ({
  getChainConfig: vi.fn(() => ({
    rpcUrl: 'http://localhost:8545',
    chainId: 11155111,
  })),
}));

vi.mock('@/app/lib/quotas/crypto-quota', () => ({
  precheckCryptoSpend: vi.fn(),
  recordCryptoSpend: vi.fn(),
  isCryptoQuotaFeatureActive: vi.fn(() => false),
}));

// Viem mocks
const mockSendTransaction = vi.fn();
const mockWaitForTransactionReceipt = vi.fn();
const mockGetBalance = vi.fn();
const mockEstimateGas = vi.fn();
const mockGetGasPrice = vi.fn();
const mockGetChainId = vi.fn();

vi.mock('viem', () => ({
  createWalletClient: vi.fn(() => ({
    sendTransaction: mockSendTransaction,
    getChainId: mockGetChainId,
  })),
  createPublicClient: vi.fn(() => ({
    waitForTransactionReceipt: mockWaitForTransactionReceipt,
    getBalance: mockGetBalance,
    estimateGas: mockEstimateGas,
    getGasPrice: mockGetGasPrice,
  })),
  http: vi.fn((url: string) => url),
  parseEther: vi.fn((val: string) => BigInt(parseFloat(val) * 1e18)),
  formatEther: vi.fn((val: bigint) => (Number(val) / 1e18).toString()),
}));

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn(() => ({
    address: '0xSenderAddress123456789012345678901234567890',
  })),
}));

describe('send-crypto tool', () => {
  let sendCryptoTool: any;
  let aiServerConfig: any;
  let getChainConfig: any;
  let quotaMocks: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset module state
    vi.resetModules();

    // Get fresh imports
    aiServerConfig = await import('@config/ai.server').then(m => m.aiServerConfig);
    getChainConfig = await import('@config/chain').then(m => m.getChainConfig);
    quotaMocks = await import('@/app/lib/quotas/crypto-quota');

    // Default successful transaction setup
    mockGetBalance.mockResolvedValue(BigInt(1e18)); // 1 ETH
    mockEstimateGas.mockResolvedValue(BigInt(21000));
    mockGetGasPrice.mockResolvedValue(BigInt(1e9)); // 1 gwei
    mockSendTransaction.mockResolvedValue('0xTxHash123');
    mockWaitForTransactionReceipt.mockResolvedValue({
      status: 'success',
      blockNumber: 12345n,
      gasUsed: 21000n,
      cumulativeGasUsed: 50000n,
    });
    mockGetChainId.mockResolvedValue(11155111);

    // Import tool after mocks are set
    sendCryptoTool = await import('../send-crypto').then(m => m.default);
  });

  describe('input validation', () => {
    it('fails when amountEth is below 0.1', async () => {
      (aiServerConfig as any).secrets.aiPrivateKey = '0xPrivateKey';
      const params = { amountEth: 0.05, __jwt: { address: '0xRecipient' } };

      await expect(sendCryptoTool.handler(params)).rejects.toThrow(
        'amountEth must be between 0.1 and 0.3 ETH'
      );
    });

    it('fails when amountEth is above 0.3', async () => {
      (aiServerConfig as any).secrets.aiPrivateKey = '0xPrivateKey';
      const params = { amountEth: 0.5, __jwt: { address: '0xRecipient' } };

      await expect(sendCryptoTool.handler(params)).rejects.toThrow(
        'amountEth must be between 0.1 and 0.3 ETH'
      );
    });

    it('accepts valid amount at lower bound', async () => {
      (aiServerConfig as any).secrets.aiPrivateKey = '0xPrivateKey';
      const params = { 
        amountEth: 0.1, 
        __jwt: { address: '0x1234567890123456789012345678901234567890' } 
      };

      const result = await sendCryptoTool.handler(params);
      expect(result.isError).toBeUndefined();
    });

    it('accepts valid amount at upper bound', async () => {
      (aiServerConfig as any).secrets.aiPrivateKey = '0xPrivateKey';
      const params = { 
        amountEth: 0.3, 
        __jwt: { address: '0x1234567890123456789012345678901234567890' } 
      };

      const result = await sendCryptoTool.handler(params);
      expect(result.isError).toBeUndefined();
    });
  });

  describe('configuration checks', () => {
    it('fails when AI_PRIVATE_KEY is not configured', async () => {
      (aiServerConfig as any).secrets.aiPrivateKey = undefined;
      const params = { amountEth: 0.2, __jwt: { address: '0xRecipient' } };

      await expect(sendCryptoTool.handler(params)).rejects.toThrow(
        'send-crypto is unavailable: AI_PRIVATE_KEY not configured'
      );
    });
  });

  describe('JWT address extraction', () => {
    beforeEach(() => {
      (aiServerConfig as any).secrets.aiPrivateKey = '0xPrivateKey';
    });

    it('extracts address from __jwt.address', async () => {
      const params = { 
        amountEth: 0.2, 
        __jwt: { address: '0x1234567890123456789012345678901234567890' } 
      };
      const result = await sendCryptoTool.handler(params);
      expect(result.isError).toBeUndefined();
    });

    it('extracts address from __jwt.addr', async () => {
      const params = { 
        amountEth: 0.2, 
        __jwt: { addr: '0x1234567890123456789012345678901234567890' } 
      };
      const result = await sendCryptoTool.handler(params);
      expect(result.isError).toBeUndefined();
    });

    it('extracts address from __jwt.sub', async () => {
      const params = { 
        amountEth: 0.2, 
        __jwt: { sub: '0x1234567890123456789012345678901234567890' } 
      };
      const result = await sendCryptoTool.handler(params);
      expect(result.isError).toBeUndefined();
    });

    it('extracts address from jwt.address', async () => {
      const params = { 
        amountEth: 0.2, 
        jwt: { address: '0x1234567890123456789012345678901234567890' } 
      };
      const result = await sendCryptoTool.handler(params);
      expect(result.isError).toBeUndefined();
    });

    it('extracts address from user.address', async () => {
      const params = { 
        amountEth: 0.2, 
        user: { address: '0x1234567890123456789012345678901234567890' } 
      };
      const result = await sendCryptoTool.handler(params);
      expect(result.isError).toBeUndefined();
    });

    it('extracts address from session.address', async () => {
      const params = { 
        amountEth: 0.2, 
        session: { address: '0x1234567890123456789012345678901234567890' } 
      };
      const result = await sendCryptoTool.handler(params);
      expect(result.isError).toBeUndefined();
    });

    it('fails when no JWT address is available', async () => {
      const params = { amountEth: 0.2 };

      await expect(sendCryptoTool.handler(params)).rejects.toThrow(
        'No JWT-bound address available'
      );
    });

    it('fails when JWT address is invalid format', async () => {
      const params = { 
        amountEth: 0.2, 
        __jwt: { address: 'not-an-address' } 
      };

      await expect(sendCryptoTool.handler(params)).rejects.toThrow(
        'No JWT-bound address available'
      );
    });

    it('normalizes address to lowercase', async () => {
      const params = { 
        amountEth: 0.2, 
        __jwt: { address: '0xABCDEF1234567890123456789012345678901234' } 
      };
      const result = await sendCryptoTool.handler(params);
      expect(result.isError).toBeUndefined();
    });
  });

  describe('balance checks', () => {
    beforeEach(() => {
      (aiServerConfig as any).secrets.aiPrivateKey = '0xPrivateKey';
    });

    it('fails when sender balance is insufficient', async () => {
      mockGetBalance.mockResolvedValue(BigInt(1e17)); // 0.1 ETH
      mockEstimateGas.mockResolvedValue(BigInt(21000));
      mockGetGasPrice.mockResolvedValue(BigInt(50e9)); // 50 gwei

      const params = { 
        amountEth: 0.2, 
        __jwt: { address: '0x1234567890123456789012345678901234567890' } 
      };

      const result = await sendCryptoTool.handler(params);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Insufficient balance');
    });

    it('succeeds when sender has sufficient balance', async () => {
      mockGetBalance.mockResolvedValue(BigInt(5e17)); // 0.5 ETH
      const params = { 
        amountEth: 0.2, 
        __jwt: { address: '0x1234567890123456789012345678901234567890' } 
      };

      const result = await sendCryptoTool.handler(params);
      expect(result.isError).toBeUndefined();
    });
  });

  describe('transaction execution', () => {
    beforeEach(() => {
      (aiServerConfig as any).secrets.aiPrivateKey = '0xPrivateKey';
    });

    it('sends transaction with correct parameters', async () => {
      const params = { 
        amountEth: 0.15, 
        __jwt: { address: '0x1234567890123456789012345678901234567890' } 
      };

      await sendCryptoTool.handler(params);

      expect(mockSendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: expect.stringContaining('0x1234567890123456789012345678901234567890'),
          value: expect.any(BigInt),
        })
      );
    });

    it('waits for transaction receipt', async () => {
      const params = { 
        amountEth: 0.2, 
        __jwt: { address: '0x1234567890123456789012345678901234567890' } 
      };

      await sendCryptoTool.handler(params);

      expect(mockWaitForTransactionReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          hash: '0xTxHash123',
          timeout: 90_000,
        })
      );
    });

    it('returns success result with all required fields', async () => {
      const params = { 
        amountEth: 0.2, 
        __jwt: { address: '0x1234567890123456789012345678901234567890' } 
      };

      const result = await sendCryptoTool.handler(params);

      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(2);
      expect(result.content[0]).toMatchObject({ type: 'text' });
      expect(result.content[1]).toMatchObject({ type: 'json' });

      const jsonContent = result.content[1] as any;
      expect(jsonContent.data).toMatchObject({
        status: 'success',
        hash: '0xTxHash123',
        from: expect.any(String),
        to: expect.stringContaining('0x123456'),
        amountEth: 0.2,
        chainId: expect.any(Number),
        receipt: expect.objectContaining({
          blockNumber: expect.anything(),
          gasUsed: expect.anything(),
        }),
      });
    });

    it('includes explorer URL in result', async () => {
      const params = { 
        amountEth: 0.2, 
        __jwt: { address: '0x1234567890123456789012345678901234567890' } 
      };

      const result = await sendCryptoTool.handler(params);
      const jsonContent = result.content[1] as any;
      
      expect(jsonContent.data.explorerUrl).toBeTruthy();
      expect(jsonContent.data.explorerUrl).toContain('0xTxHash123');
    });

    it('handles failed transaction status', async () => {
      mockWaitForTransactionReceipt.mockResolvedValue({
        status: 'reverted',
        blockNumber: 12345n,
        gasUsed: 21000n,
        cumulativeGasUsed: 50000n,
      });

      const params = { 
        amountEth: 0.2, 
        __jwt: { address: '0x1234567890123456789012345678901234567890' } 
      };

      const result = await sendCryptoTool.handler(params);
      const jsonContent = result.content[1] as any;
      
      expect(jsonContent.data.status).toBe('failed');
    });
  });

  describe('crypto quota integration', () => {
    beforeEach(() => {
      (aiServerConfig as any).secrets.aiPrivateKey = '0xPrivateKey';
    });

    it('records spend when quota feature is active', async () => {
      (quotaMocks.isCryptoQuotaFeatureActive as any).mockReturnValue(true);

      const params = { 
        amountEth: 0.25, 
        __jwt: { address: '0x1234567890123456789012345678901234567890' } 
      };

      await sendCryptoTool.handler(params);

      expect(quotaMocks.recordCryptoSpend).toHaveBeenCalledWith(
        expect.stringContaining('0x123456'),
        0.25
      );
    });

    it('does not record spend when quota feature is inactive', async () => {
      (quotaMocks.isCryptoQuotaFeatureActive as any).mockReturnValue(false);

      const params = { 
        amountEth: 0.2, 
        __jwt: { address: '0x1234567890123456789012345678901234567890' } 
      };

      await sendCryptoTool.handler(params);

      expect(quotaMocks.recordCryptoSpend).not.toHaveBeenCalled();
    });

    it('continues even if quota recording fails', async () => {
      (quotaMocks.isCryptoQuotaFeatureActive as any).mockReturnValue(true);
      (quotaMocks.recordCryptoSpend as any).mockRejectedValue(
        new Error('Quota service unavailable')
      );

      const params = { 
        amountEth: 0.2, 
        __jwt: { address: '0x1234567890123456789012345678901234567890' } 
      };

      const result = await sendCryptoTool.handler(params);
      expect(result.isError).toBeUndefined();
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      (aiServerConfig as any).secrets.aiPrivateKey = '0xPrivateKey';
    });

    it('returns error result when transaction fails', async () => {
      mockSendTransaction.mockRejectedValue(new Error('Network error'));

      const params = { 
        amountEth: 0.2, 
        __jwt: { address: '0x1234567890123456789012345678901234567890' } 
      };

      const result = await sendCryptoTool.handler(params);
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Network error');
    });

    it('returns error result when balance check fails', async () => {
      mockGetBalance.mockRejectedValue(new Error('RPC error'));

      const params = { 
        amountEth: 0.2, 
        __jwt: { address: '0x1234567890123456789012345678901234567890' } 
      };

      const result = await sendCryptoTool.handler(params);
      
      expect(result.isError).toBe(true);
    });

    it('handles receipt timeout gracefully', async () => {
      mockWaitForTransactionReceipt.mockRejectedValue(
        new Error('Transaction receipt timeout')
      );

      const params = { 
        amountEth: 0.2, 
        __jwt: { address: '0x1234567890123456789012345678901234567890' } 
      };

      const result = await sendCryptoTool.handler(params);
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('timeout');
    });
  });

  describe('tool metadata', () => {
    it('has correct tool name', () => {
      expect(sendCryptoTool.tool.name).toBe('send_crypto_to_signed_in_user');
    });

    it('requires JWT', () => {
      expect(sendCryptoTool.requiresJwt).toBe(true);
    });

    it('has valid input schema', () => {
      expect(sendCryptoTool.tool.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          amountEth: expect.objectContaining({
            type: 'number',
            minimum: 0.1,
            maximum: 0.3,
          }),
        },
        required: ['amountEth'],
      });
    });
  });
});