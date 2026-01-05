// dapp/app/lib/mcp/tools/__tests__/mark-key-used.test.ts

// Mock dependencies before importing the tool
vi.mock('@logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../utils/chains', () => ({
  isValidAddress: vi.fn(),
  formatChainName: vi.fn(),
  getRpcUrl: vi.fn(),
}));

vi.mock('../../../prisma/prismaNetworkUtils', () => ({
  prisma: {},
  getTokenModel: vi.fn(),
}));

vi.mock('@config/chain', () => ({
  getActiveChain: vi.fn(),
  Chain: {
    ETHEREUM: 'ethereum',
    SEPOLIA: 'sepolia',
    RITONET: 'ritonet',
  },
}));

vi.mock('@schemas/domain/chains', () => ({
  isSupportedChain: vi.fn((chain: string) => ['mainnet', 'sepolia', 'ritonet'].includes(chain)),
}));

vi.mock('../tool-errors', () => ({
  fail: (msg: string) => {
    throw new Error(msg);
  },
  errorResultShape: (msg: string) => ({
    content: [{ type: 'text', text: msg }],
    isError: true,
  }),
}));

// Import after mocks
import markKeyUsedTool from '../mark-key-used';
import { isValidAddress, formatChainName } from '../../utils/chains';
import { getTokenModel } from '../../../prisma/prismaNetworkUtils';
import { getActiveChain } from '@config/chain';

describe('mark-key-used tool', () => {
  const mockTokenModel = {
    updateMany: vi.fn(),
    findUnique: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getTokenModel as any).mockReturnValue(mockTokenModel);
    (getActiveChain as any).mockReturnValue('ethereum');
    (formatChainName as any).mockReturnValue('Ethereum');
    (isValidAddress as any).mockReturnValue(true);
  });

  describe('tool metadata', () => {
    it('should have correct tool properties', () => {
      expect(markKeyUsedTool.tool.name).toBe('mark_key_used');
      expect(markKeyUsedTool.requiresJwt).toBe(true);
      expect(markKeyUsedTool.tool.inputSchema).toBeDefined();
      expect(markKeyUsedTool.handler).toBeTypeOf('function');
    });
  });

  describe('handler - success cases', () => {
    it('should successfully mark an unused token as used', async () => {
      const now = new Date('2025-10-09T12:00:00Z');
      const params = {
        __jwt: {
          address: '0x1234567890123456789012345678901234567890',
          tokenId: 42,
        },
      };

      mockTokenModel.updateMany.mockResolvedValue({ count: 1 });
      mockTokenModel.findUnique.mockResolvedValue({
        tokenId: 42,
        used: true,
        usedBy: '0x1234567890123456789012345678901234567890',
        usedAt: now,
      });

      const result = await markKeyUsedTool.handler(params);

      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      
      const textContent = result.content.find((c: any) => c.type === 'text');
      expect(textContent).toBeDefined();
      expect(textContent?.text).toContain('Marked key #42');
      
      const jsonContent = result.content.find((c: any) => c.type === 'json');
      expect(jsonContent).toBeDefined();
      expect(jsonContent?.data).toMatchObject({
        status: 'success',
        tokenId: 42,
      });
    });

    it('should handle tokenId from different JWT claim locations', async () => {
      const params = {
        jwt: {
          address: '0x1234567890123456789012345678901234567890',
          tokenId: '99',
        },
      };

      mockTokenModel.updateMany.mockResolvedValue({ count: 1 });
      mockTokenModel.findUnique.mockResolvedValue({
        tokenId: 99,
        used: true,
        usedBy: '0x1234567890123456789012345678901234567890',
        usedAt: new Date(),
      });

      const result = await markKeyUsedTool.handler(params);

      expect(mockTokenModel.updateMany).toHaveBeenCalledWith({
        where: { tokenId: 99, used: false },
        data: expect.objectContaining({
          used: true,
          usedBy: expect.any(String),
          usedAt: expect.any(Date),
        }),
      });
    });

    it('should lowercase the address in the database', async () => {
      const params = {
        __jwt: {
          address: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
          tokenId: 42,
        },
      };

      mockTokenModel.updateMany.mockResolvedValue({ count: 1 });
      mockTokenModel.findUnique.mockResolvedValue({
        tokenId: 42,
        used: true,
        usedBy: '0xabcdef1234567890abcdef1234567890abcdef12',
        usedAt: new Date(),
      });

      await markKeyUsedTool.handler(params);

      expect(mockTokenModel.updateMany).toHaveBeenCalledWith({
        where: { tokenId: 42, used: false },
        data: expect.objectContaining({
          usedBy: '0xabcdef1234567890abcdef1234567890abcdef12',
        }),
      });
    });
  });

  describe('handler - validation failures', () => {
    it('should fail when JWT address is missing', async () => {
      const params = {
        __jwt: {
          tokenId: 42,
        },
      };

      (isValidAddress as any).mockReturnValue(false);

      const result = await markKeyUsedTool.handler(params);

      const textContent = result.content.find((c: any) => c.type === 'text');
      expect(textContent?.text).toContain('Not signed in');
      expect(result.isError).toBe(true);
    });

    it('should fail when JWT address is invalid', async () => {
      const params = {
        __jwt: {
          address: 'invalid-address',
          tokenId: 42,
        },
      };

      (isValidAddress as any).mockReturnValue(false);

      const result = await markKeyUsedTool.handler(params);

      const textContent = result.content.find((c: any) => c.type === 'text');
      expect(textContent?.text).toContain('Not signed in');
      expect(result.isError).toBe(true);
    });

    it('should fail when tokenId is missing', async () => {
      const params = {
        __jwt: {
          address: '0x1234567890123456789012345678901234567890',
        },
      };

      const result = await markKeyUsedTool.handler(params);

      const textContent = result.content.find((c: any) => c.type === 'text');
      expect(textContent?.text).toContain('Missing or invalid tokenId');
      expect(result.isError).toBe(true);
    });

    it('should fail when tokenId is not a valid number', async () => {
      const params = {
        __jwt: {
          address: '0x1234567890123456789012345678901234567890',
          tokenId: 'not-a-number',
        },
      };

      const result = await markKeyUsedTool.handler(params);

      const textContent = result.content.find((c: any) => c.type === 'text');
      expect(textContent?.text).toContain('Missing or invalid tokenId');
      expect(result.isError).toBe(true);
    });
  });

  describe('handler - token state errors', () => {
    it('should fail when token is not found', async () => {
      const params = {
        __jwt: {
          address: '0x1234567890123456789012345678901234567890',
          tokenId: 42,
        },
      };

      mockTokenModel.updateMany.mockResolvedValue({ count: 0 });
      mockTokenModel.findUnique.mockResolvedValue(null);

      const result = await markKeyUsedTool.handler(params);

      const textContent = result.content.find((c: any) => c.type === 'text');
      expect(textContent?.text).toContain('Token 42 not found on Ethereum');
      expect(result.isError).toBe(true);
    });

    it('should fail when token is already used', async () => {
      const params = {
        __jwt: {
          address: '0x1234567890123456789012345678901234567890',
          tokenId: 42,
        },
      };

      mockTokenModel.updateMany.mockResolvedValue({ count: 0 });
      mockTokenModel.findUnique.mockResolvedValue({
        tokenId: 42,
        used: true,
        usedBy: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        usedAt: new Date('2025-10-01T10:00:00Z'),
      });

      const result = await markKeyUsedTool.handler(params);

      const textContent = result.content.find((c: any) => c.type === 'text');
      expect(textContent?.text).toContain('Token #42 is already used on Ethereum');
      expect(textContent?.text).toContain('0xabcd…abcd');
      expect(textContent?.text).toContain('2025-10-01');
      expect(result.isError).toBe(true);
    });

    it('should handle unexpected state when update returns 0 but token exists unused', async () => {
      const params = {
        __jwt: {
          address: '0x1234567890123456789012345678901234567890',
          tokenId: 42,
        },
      };

      mockTokenModel.updateMany.mockResolvedValue({ count: 0 });
      mockTokenModel.findUnique.mockResolvedValue({
        tokenId: 42,
        used: false,
      });

      const result = await markKeyUsedTool.handler(params);

      const textContent = result.content.find((c: any) => c.type === 'text');
      expect(textContent?.text).toContain('Failed to mark token as used (unexpected state)');
      expect(result.isError).toBe(true);
    });

    it('should fail when verification shows token not marked as used', async () => {
      const params = {
        __jwt: {
          address: '0x1234567890123456789012345678901234567890',
          tokenId: 42,
        },
      };

      mockTokenModel.updateMany.mockResolvedValue({ count: 1 });
      mockTokenModel.findUnique.mockResolvedValue({
        tokenId: 42,
        used: false,
      });

      const result = await markKeyUsedTool.handler(params);

      const textContent = result.content.find((c: any) => c.type === 'text');
      expect(textContent?.text).toContain('Verification failed');
      expect(result.isError).toBe(true);
    });
  });

  describe('handler - chain handling', () => {
    it('should work with sepolia chain', async () => {
      (getActiveChain as any).mockReturnValue('sepolia');
      (formatChainName as any).mockReturnValue('Sepolia');

      const params = {
        __jwt: {
          address: '0x1234567890123456789012345678901234567890',
          tokenId: 42,
        },
      };

      mockTokenModel.updateMany.mockResolvedValue({ count: 1 });
      mockTokenModel.findUnique.mockResolvedValue({
        tokenId: 42,
        used: true,
        usedBy: '0x1234567890123456789012345678901234567890',
        usedAt: new Date(),
      });

      const result = await markKeyUsedTool.handler(params);

      const textContent = result.content.find((c: any) => c.type === 'text');
      expect(textContent?.text).toContain('Sepolia');
    });

    it('should work with ritonet chain', async () => {
      (getActiveChain as any).mockReturnValue('ritonet');
      (formatChainName as any).mockReturnValue('Ritonet');

      const params = {
        __jwt: {
          address: '0x1234567890123456789012345678901234567890',
          tokenId: 42,
        },
      };

      mockTokenModel.updateMany.mockResolvedValue({ count: 1 });
      mockTokenModel.findUnique.mockResolvedValue({
        tokenId: 42,
        used: true,
        usedBy: '0x1234567890123456789012345678901234567890',
        usedAt: new Date(),
      });

      const result = await markKeyUsedTool.handler(params);

      const textContent = result.content.find((c: any) => c.type === 'text');
      expect(textContent?.text).toContain('Ritonet');
    });

    it('should call getTokenModel with prisma instance', async () => {
      const params = {
        __jwt: {
          address: '0x1234567890123456789012345678901234567890',
          tokenId: 42,
        },
      };

      mockTokenModel.updateMany.mockResolvedValue({ count: 1 });
      mockTokenModel.findUnique.mockResolvedValue({
        tokenId: 42,
        used: true,
        usedBy: '0x1234567890123456789012345678901234567890',
        usedAt: new Date(),
      });

      await markKeyUsedTool.handler(params);

      expect(getTokenModel).toHaveBeenCalled();
    });
  });

  describe('handler - error handling', () => {
    it('should handle database errors gracefully', async () => {
      const params = {
        __jwt: {
          address: '0x1234567890123456789012345678901234567890',
          tokenId: 42,
        },
      };

      mockTokenModel.updateMany.mockRejectedValue(new Error('Database connection failed'));

      const result = await markKeyUsedTool.handler(params);

      expect(result.isError).toBe(true);
      const textContent = result.content.find((c: any) => c.type === 'text');
      expect(textContent?.text).toContain('Database connection failed');
    });

    it('should handle non-Error thrown values', async () => {
      const params = {
        __jwt: {
          address: '0x1234567890123456789012345678901234567890',
          tokenId: 42,
        },
      };

      mockTokenModel.updateMany.mockRejectedValue('string error');

      const result = await markKeyUsedTool.handler(params);

      expect(result.isError).toBe(true);
    });
  });

  describe('output format', () => {
    it('should return both text and JSON content on success', async () => {
      const params = {
        __jwt: {
          address: '0x1234567890123456789012345678901234567890',
          tokenId: 42,
        },
      };

      mockTokenModel.updateMany.mockResolvedValue({ count: 1 });
      mockTokenModel.findUnique.mockResolvedValue({
        tokenId: 42,
        used: true,
        usedBy: '0x1234567890123456789012345678901234567890',
        usedAt: new Date('2025-10-09T12:00:00Z'),
      });

      const result = await markKeyUsedTool.handler(params);

      const textContent = result.content.find((c: any) => c.type === 'text');
      const jsonContent = result.content.find((c: any) => c.type === 'json');

      expect(textContent).toBeDefined();
      expect(jsonContent).toBeDefined();
      expect(jsonContent?.data).toMatchObject({
        status: 'success',
        tokenId: 42,
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
        chainCanonical: 'mainnet',
        chainName: 'Ethereum',
        usedAt: '2025-10-09T12:00:00.000Z',
      });
    });

    it('should format addresses with ellipsis in text output', async () => {
      const params = {
        __jwt: {
          address: '0x1234567890123456789012345678901234567890',
          tokenId: 42,
        },
      };

      mockTokenModel.updateMany.mockResolvedValue({ count: 1 });
      mockTokenModel.findUnique.mockResolvedValue({
        tokenId: 42,
        used: true,
        usedBy: '0x1234567890123456789012345678901234567890',
        usedAt: new Date(),
      });

      const result = await markKeyUsedTool.handler(params);

      const textContent = result.content.find((c: any) => c.type === 'text');
      expect(textContent?.text).toMatch(/0x[a-fA-F0-9]{4}…[a-fA-F0-9]{4}/);
    });
  });
});