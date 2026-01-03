// dapp/app/lib/mcp/tools/__tests__/pinecone-search.test.ts
import { Pinecone } from '@pinecone-database/pinecone';

// Mock dependencies before imports
vi.mock('@logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  }),
}));

vi.mock('@config/pinecone.config', () => ({
  pineconeConfig: {
    apiKey: 'test-api-key',
    indexes: [
      {
        name: 'test-index',
        namespaces: ['__default__', 'gifs', 'docs'],
      },
      {
        name: 'other-index',
        namespaces: ['__default__', 'images'],
      },
    ],
    getIndexNames: () => ['test-index', 'other-index'],
    getNamespacesForIndex: (indexName: string) => {
      const idx = [
        { name: 'test-index', namespaces: ['__default__', 'gifs', 'docs'] },
        { name: 'other-index', namespaces: ['__default__', 'images'] },
      ].find((i) => i.name === indexName);
      return idx?.namespaces;
    },
    isValidIndexNamespace: (indexName: string, namespace: string) => {
      const namespaces = [
        { name: 'test-index', namespaces: ['__default__', 'gifs', 'docs'] },
        { name: 'other-index', namespaces: ['__default__', 'images'] },
      ].find((i) => i.name === indexName)?.namespaces;
      return namespaces?.includes(namespace) ?? false;
    },
  },
}));

vi.mock('@pinecone-database/pinecone', () => {
  const mockQuery = vi.fn();
  const mockNamespace = vi.fn(() => ({ query: mockQuery }));
  const mockIndex = vi.fn(() => ({ namespace: mockNamespace }));
  const mockEmbed = vi.fn();

  return {
    Pinecone: vi.fn(() => ({
      index: mockIndex,
      inference: {
        embed: mockEmbed,
      },
    })),
  };
});

// Now import the tool
import pineconeSearchTool from '../pinecone-search';

describe('pinecone-search tool', () => {
  let mockPineconeInstance: any;
  let mockEmbed: any;
  let mockQuery: any;
  let mockNamespace: any;
  let mockIndex: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Get references to the mocked functions
    mockPineconeInstance = new Pinecone({ apiKey: 'test-key' });
    mockEmbed = mockPineconeInstance.inference.embed;
    mockIndex = mockPineconeInstance.index;
    mockNamespace = vi.fn(() => ({ query: mockQuery }));
    mockQuery = vi.fn();
    
    mockIndex.mockReturnValue({ namespace: mockNamespace });
    mockNamespace.mockReturnValue({ query: mockQuery });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('tool metadata', () => {
    it('should have correct name and description', () => {
      expect(pineconeSearchTool.tool.name).toBe('pinecone_search');
      expect(pineconeSearchTool.tool.description).toContain('semantic vector search');
    });

    it('should have proper input schema', () => {
      const schema = pineconeSearchTool.tool.inputSchema as any;
      expect(schema.type).toBe('object');
      expect(schema.properties.query).toBeDefined();
      expect(schema.properties.index).toBeDefined();
      expect(schema.properties.namespace).toBeDefined();
      expect(schema.properties.topK).toBeDefined();
      expect(schema.required).toEqual(['query', 'index']);
    });
  });

  describe('validation', () => {
    it('should fail when query is empty', async () => {
      await expect(
        pineconeSearchTool.handler({
          query: '',
          index: 'test-index',
        })
      ).rejects.toThrow('Query text is required');
    });

    it('should fail when index is not provided', async () => {
      await expect(
        pineconeSearchTool.handler({
          query: 'test query',
          index: '',
        })
      ).rejects.toThrow('Index name is required');
    });

    it('should fail when index does not exist', async () => {
      await expect(
        pineconeSearchTool.handler({
          query: 'test query',
          index: 'nonexistent-index',
        })
      ).rejects.toThrow('Index "nonexistent-index" not found');
    });

    it('should fail when namespace is invalid for the index', async () => {
      await expect(
        pineconeSearchTool.handler({
          query: 'test query',
          index: 'test-index',
          namespace: 'invalid-namespace',
        })
      ).rejects.toThrow('Namespace "invalid-namespace" not found');
    });

    it('should use default namespace when not provided', async () => {
      mockEmbed.mockResolvedValue({
        vectorType: 'dense',
        data: [{ vectorType: 'dense', values: [0.1, 0.2, 0.3] }],
      });

      mockQuery.mockResolvedValue({
        matches: [],
      });

      await pineconeSearchTool.handler({
        query: 'test query',
        index: 'test-index',
      });

      expect(mockNamespace).toHaveBeenCalledWith('__default__');
    });
  });

  describe('successful searches', () => {
    beforeEach(() => {
      mockEmbed.mockResolvedValue({
        vectorType: 'dense',
        data: [{ vectorType: 'dense', values: [0.1, 0.2, 0.3] }],
      });
    });

    it('should perform successful search with results', async () => {
      const mockMatches = [
        {
          id: 'doc1',
          score: 0.95,
          metadata: {
            title: 'Test Document',
            description: 'A test document',
            url: 'https://example.com/doc1',
          },
        },
        {
          id: 'doc2',
          score: 0.85,
          metadata: {
            title: 'Another Document',
            text: 'Some text here',
          },
        },
      ];

      mockQuery.mockResolvedValue({ matches: mockMatches });

      const result = await pineconeSearchTool.handler({
        query: 'test query',
        index: 'test-index',
        namespace: 'docs',
        topK: 5,
      });

      expect(result.content).toHaveLength(2); // text and json results
      expect(result.isError).toBeUndefined();

      // Check text result
      const textContent = result.content.find((c: any) => c.type === 'text');
      expect(textContent?.text).toContain('Found 2 results');
      expect(textContent?.text).toContain('Test Document');
      expect(textContent?.text).toContain('A test document');

      // Check JSON result
      const jsonContent = result.content.find((c: any) => c.type === 'json');
      expect(jsonContent).toBeDefined();
      
      const jsonData = jsonContent!.data as any;
      expect(jsonData.totalMatches).toBe(2);
      expect(jsonData.matches[0].url).toBe('https://example.com/doc1');
      expect(jsonData.matches[1].url).toBeUndefined();
    });

    it('should handle empty search results', async () => {
      mockQuery.mockResolvedValue({ matches: [] });

      const result = await pineconeSearchTool.handler({
        query: 'no results query',
        index: 'test-index',
      });

      const textContent = result.content.find((c: any) => c.type === 'text');
      expect(textContent?.text).toContain('Found 0 results');
      expect(textContent?.text).toContain('No matching results found');
    });

    it('should respect topK parameter', async () => {
      const mockMatches = Array.from({ length: 10 }, (_, i) => ({
        id: `doc${i}`,
        score: 0.9 - i * 0.05,
        metadata: { title: `Doc ${i}` },
      }));

      mockQuery.mockResolvedValue({ matches: mockMatches });

      const result = await pineconeSearchTool.handler({
        query: 'test query',
        index: 'test-index',
        topK: 3,
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({ topK: 3 })
      );

      const jsonContent = result.content.find((c: any) => c.type === 'json');
      const jsonData = jsonContent!.data as any;
      expect(jsonData.totalMatches).toBe(10);
    });

    it('should include metadata filter when provided', async () => {
      mockQuery.mockResolvedValue({ matches: [] });

      const filter = { category: 'docs', version: 2 };

      await pineconeSearchTool.handler({
        query: 'test query',
        index: 'test-index',
        filter,
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({ filter })
      );
    });

    it('should not include empty filter', async () => {
      mockQuery.mockResolvedValue({ matches: [] });

      await pineconeSearchTool.handler({
        query: 'test query',
        index: 'test-index',
        filter: {},
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.not.objectContaining({ filter: {} })
      );
    });
  });

  describe('gifs namespace special handling', () => {
    beforeEach(() => {
      mockEmbed.mockResolvedValue({
        vectorType: 'dense',
        data: [{ vectorType: 'dense', values: [0.1, 0.2, 0.3] }],
      });
    });

    it('should include gif tags in text summary for gifs namespace', async () => {
      const mockMatches = [
        {
          id: 'gif1',
          score: 0.95,
          metadata: {
            name: 'Funny Cat',
            url: 'https://example.com/cat.gif',
          },
        },
        {
          id: 'gif2',
          score: 0.85,
          metadata: {
            name: 'Dancing Dog',
            url: 'https://example.com/dog.gif',
          },
        },
      ];

      mockQuery.mockResolvedValue({ matches: mockMatches });

      const result = await pineconeSearchTool.handler({
        query: 'funny animals',
        index: 'test-index',
        namespace: 'gifs',
      });

      const textContent = result.content.find((c: any) => c.type === 'text');
      expect(textContent?.text).toContain('<gif url="https://example.com/cat.gif" width="280" />');
      expect(textContent?.text).toContain('<gif url="https://example.com/dog.gif" width="280" />');
      expect(textContent?.text).toContain('url: https://example.com/cat.gif');
      expect(textContent?.text).toContain('url: https://example.com/dog.gif');
    });

    it('should not include gif tags for non-gifs namespace', async () => {
      const mockMatches = [
        {
          id: 'doc1',
          score: 0.95,
          metadata: {
            title: 'Document',
            url: 'https://example.com/doc',
          },
        },
      ];

      mockQuery.mockResolvedValue({ matches: mockMatches });

      const result = await pineconeSearchTool.handler({
        query: 'document',
        index: 'test-index',
        namespace: 'docs',
      });

      const textContent = result.content.find((c: any) => c.type === 'text');
      expect(textContent?.text).not.toContain('<gif');
    });
  });

  describe('error handling', () => {
    it('should handle embedding generation failure', async () => {
      mockEmbed.mockRejectedValue(new Error('Embedding service unavailable'));

      const result = await pineconeSearchTool.handler({
        query: 'test query',
        index: 'test-index',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]).toMatchObject({
        type: 'text',
        text: expect.stringContaining('Embedding service unavailable'),
      });
    });

    it('should handle non-dense embedding response', async () => {
      mockEmbed.mockResolvedValue({
        vectorType: 'sparse',
        data: [],
      });

      const result = await pineconeSearchTool.handler({
        query: 'test query',
        index: 'test-index',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]).toMatchObject({
        type: 'text',
        text: expect.stringContaining('Expected dense embeddings'),
      });
    });

    it('should handle query execution failure', async () => {
      mockEmbed.mockResolvedValue({
        vectorType: 'dense',
        data: [{ vectorType: 'dense', values: [0.1, 0.2] }],
      });

      mockQuery.mockRejectedValue(new Error('Index not found'));

      const result = await pineconeSearchTool.handler({
        query: 'test query',
        index: 'test-index',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]).toMatchObject({
        type: 'text',
        text: expect.stringContaining('Index not found'),
      });
    });

    it('should handle generic errors gracefully', async () => {
      mockEmbed.mockRejectedValue('Unknown error');

      const result = await pineconeSearchTool.handler({
        query: 'test query',
        index: 'test-index',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Failed to perform vector search');
    });
  });

  describe('text summary formatting', () => {
    beforeEach(() => {
      mockEmbed.mockResolvedValue({
        vectorType: 'dense',
        data: [{ vectorType: 'dense', values: [0.1, 0.2, 0.3] }],
      });
    });

    it('should show top 3 results in summary', async () => {
      const mockMatches = Array.from({ length: 10 }, (_, i) => ({
        id: `doc${i}`,
        score: 0.9 - i * 0.05,
        metadata: { title: `Doc ${i}` },
      }));

      mockQuery.mockResolvedValue({ matches: mockMatches });

      const result = await pineconeSearchTool.handler({
        query: 'test query',
        index: 'test-index',
      });

      const textContent = result.content.find((c: any) => c.type === 'text');
      expect(textContent?.text).toContain('Doc 0');
      expect(textContent?.text).toContain('Doc 1');
      expect(textContent?.text).toContain('Doc 2');
      expect(textContent?.text).toContain('...and 7 more results');
    });

    it('should truncate long descriptions', async () => {
      const longDescription = 'a'.repeat(200);
      const mockMatches = [
        {
          id: 'doc1',
          score: 0.95,
          metadata: {
            title: 'Document',
            description: longDescription,
          },
        },
      ];

      mockQuery.mockResolvedValue({ matches: mockMatches });

      const result = await pineconeSearchTool.handler({
        query: 'test query',
        index: 'test-index',
      });

      const textContent = result.content.find((c: any) => c.type === 'text');
      expect(textContent?.text).toContain('...');
      if (textContent?.text) {
        expect(textContent.text.length).toBeLessThan(longDescription.length + 500);
      }
    });
  });
});