// dapp/app/lib/mcp/tools/__tests__/keynft-used-count.test.ts

// Mock logger
vi.mock('@logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock Token model
const mockTokenCount = vi.fn();
const mockTokenModel = {
  count: mockTokenCount,
  findMany: vi.fn(),
};

// Mock getTokenModel function
const mockGetTokenModel = vi.fn(() => mockTokenModel);

// Mock prisma utilities
vi.mock('@lib/prisma/prismaNetworkUtils', () => ({
  getTokenModel: mockGetTokenModel,
  prisma: {},
}));

describe('keynft-used-count tool', () => {
  let keynftUsedCountTool: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset the mock implementations
    mockGetTokenModel.mockReturnValue(mockTokenModel);
    mockTokenCount.mockResolvedValue(42);

    // Import fresh module
    vi.resetModules();
    keynftUsedCountTool = await import('../keynft-used-count').then(m => m.default);
  });

  describe('successful execution', () => {
    it('returns count of used tokens', async () => {
      mockTokenCount.mockResolvedValue(15);

      const result = await keynftUsedCountTool.handler({});

      expect(mockTokenCount).toHaveBeenCalledWith({ where: { used: true } });
      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(2);
    });

    it('returns both text and json content', async () => {
      mockTokenCount.mockResolvedValue(7);

      const result = await keynftUsedCountTool.handler({});

      const textContent = result.content.find((c: any) => c.type === 'text');
      const jsonContent = result.content.find((c: any) => c.type === 'json');

      expect(textContent).toBeDefined();
      expect(textContent.text).toBe('7');
      
      expect(jsonContent).toBeDefined();
      expect(jsonContent.data).toEqual({ total: 7 });
    });

    it('handles zero count correctly', async () => {
      mockTokenCount.mockResolvedValue(0);

      const result = await keynftUsedCountTool.handler({});

      const textContent = result.content.find((c: any) => c.type === 'text');
      const jsonContent = result.content.find((c: any) => c.type === 'json');

      expect(textContent.text).toBe('0');
      expect(jsonContent.data.total).toBe(0);
    });

    it('handles large count values', async () => {
      mockTokenCount.mockResolvedValue(999999);

      const result = await keynftUsedCountTool.handler({});

      const jsonContent = result.content.find((c: any) => c.type === 'json');
      expect(jsonContent.data.total).toBe(999999);
    });
  });

  describe('error handling', () => {
    it('returns error result when database query fails', async () => {
      mockTokenCount.mockRejectedValue(new Error('Database connection failed'));

      const result = await keynftUsedCountTool.handler({});

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Database connection failed');
    });

    it('handles non-Error exceptions with fallback message', async () => {
      mockTokenCount.mockRejectedValue('String error');

      const result = await keynftUsedCountTool.handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Failed to compute used key total');
    });

    it('provides fallback error message for unknown errors', async () => {
      mockTokenCount.mockRejectedValue(null);

      const result = await keynftUsedCountTool.handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Failed to compute used key total');
    });

    it('handles model not found error', async () => {
      mockGetTokenModel.mockImplementation(() => {
        throw new Error('Token model not found for active chain');
      });

      const result = await keynftUsedCountTool.handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Token model not found');
    });
  });

  describe('tool metadata', () => {
    it('has correct tool name', () => {
      expect(keynftUsedCountTool.tool.name).toBe('keynft_used_count');
    });

    it('has appropriate description', () => {
      expect(keynftUsedCountTool.tool.description).toContain('key NFTs');
      expect(keynftUsedCountTool.tool.description).toContain('used=true');
    });

    it('does not require JWT', () => {
      expect(keynftUsedCountTool.requiresJwt).toBe(false);
    });

    it('has valid input schema with no required params', () => {
      expect(keynftUsedCountTool.tool.inputSchema).toMatchObject({
        type: 'object',
        properties: {},
        additionalProperties: false,
      });
    });
  });

  describe('prisma integration', () => {
    it('calls getTokenModel with prisma client', async () => {
      await keynftUsedCountTool.handler({});

      expect(mockGetTokenModel).toHaveBeenCalled();
    });

    it('queries with correct where clause', async () => {
      // Ensure clean mock state
      mockTokenCount.mockClear();
      mockTokenCount.mockResolvedValue(5);

      await keynftUsedCountTool.handler({});

      expect(mockTokenCount).toHaveBeenCalledWith({
        where: { used: true },
      });
      expect(mockTokenCount).toHaveBeenCalledTimes(1);
    });
  });
});