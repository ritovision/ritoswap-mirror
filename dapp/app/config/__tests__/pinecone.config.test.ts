// @vitest-environment node

export {} // Make this file a module to avoid global scope conflicts

// Silence logger usage inside pinecone.config.ts
vi.mock('@logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

const resetEnv = (extraKeys: string[] = []) => {
  const KEYS = [
    'PINECONE_API_KEY',
    'PINECONE_INDEX_1_NAME',
    'PINECONE_INDEX_1_NAMESPACES',
    'PINECONE_INDEX_2_NAME',
    'PINECONE_INDEX_2_NAMESPACES',
    'PINECONE_INDEX_3_NAME',
    'PINECONE_INDEX_3_NAMESPACES',
  ]
  for (const k of [...KEYS, ...extraKeys]) delete process.env[k]
}

const seedBase = (overrides: Partial<NodeJS.ProcessEnv> = {}) => {
  resetEnv()
  Object.assign(process.env, overrides)
}

const importPinecone = async () => {
  vi.resetModules()
  return await import('../pinecone.config')
}

describe('pinecone.config.ts', () => {
  beforeEach(() => {
    seedBase()
  })

  it('throws if imported in a browser-like environment', async () => {
    // Simulate client by defining window before import
    ;(global as any).window = {}
    await expect(importPinecone()).rejects.toThrow(/SECURITY ERROR/i)
    // cleanup
    delete (global as any).window
  })

  it('isConfigured=false when no API key', async () => {
    seedBase()
    const { pineconeConfig } = await importPinecone()
    expect(pineconeConfig.isConfigured).toBe(false)
    expect(pineconeConfig.getIndexNames()).toEqual([])
    expect(pineconeConfig.getNamespacesForIndex('whatever')).toBeUndefined()
    expect(pineconeConfig.isValidIndexNamespace('foo', 'bar')).toBe(false)
    expect(pineconeConfig.getAllIndexNamespaceCombinations()).toEqual([])
  })

  it('isConfigured=false when API key present but no indexes defined', async () => {
    seedBase({ PINECONE_API_KEY: 'key' })
    const { pineconeConfig } = await importPinecone()
    expect(pineconeConfig.isConfigured).toBe(false)
  })

  it('configures with a single index and default namespace when none provided', async () => {
    seedBase({
      PINECONE_API_KEY: 'key',
      PINECONE_INDEX_1_NAME: 'search-index',
      // no namespaces → should default to ['__default__']
    })
    const { pineconeConfig } = await importPinecone()
    expect(pineconeConfig.isConfigured).toBe(true)
    expect(pineconeConfig.apiKey).toBe('key')
    expect(pineconeConfig.indexes.length).toBe(1)
    expect(pineconeConfig.indexes[0]).toEqual({
      name: 'search-index',
      namespaces: ['__default__'],
    })
    expect(pineconeConfig.getIndexNames()).toEqual(['search-index'])
    expect(pineconeConfig.getNamespacesForIndex('search-index')).toEqual(['__default__'])
    expect(pineconeConfig.isValidIndexNamespace('search-index', '__default__')).toBe(true)
    expect(pineconeConfig.getAllIndexNamespaceCombinations()).toEqual(['search-index/__default__'])
  })

  it('parses comma-separated namespaces (trimmed) and helpers reflect them', async () => {
    seedBase({
      PINECONE_API_KEY: 'key',
      PINECONE_INDEX_1_NAME: 'chat-embeddings',
      PINECONE_INDEX_1_NAMESPACES: ' ns1 ,ns2,  ns3 ',
    })
    const { pineconeConfig } = await importPinecone()
    expect(pineconeConfig.isConfigured).toBe(true)
    expect(pineconeConfig.indexes.length).toBe(1)
    expect(pineconeConfig.indexes[0].name).toBe('chat-embeddings')
    expect(pineconeConfig.indexes[0].namespaces).toEqual(['ns1', 'ns2', 'ns3'])
    expect(pineconeConfig.getIndexNames()).toEqual(['chat-embeddings'])
    expect(pineconeConfig.getNamespacesForIndex('chat-embeddings')).toEqual(['ns1', 'ns2', 'ns3'])
    expect(pineconeConfig.isValidIndexNamespace('chat-embeddings', 'ns2')).toBe(true)
    expect(pineconeConfig.isValidIndexNamespace('chat-embeddings', 'nope')).toBe(false)
    expect(pineconeConfig.getAllIndexNamespaceCombinations()).toEqual([
      'chat-embeddings/ns1',
      'chat-embeddings/ns2',
      'chat-embeddings/ns3',
    ])
  })

  it('supports multiple index slots (1..3) and aggregates combinations', async () => {
    seedBase({
      PINECONE_API_KEY: 'key',
      PINECONE_INDEX_1_NAME: 'idx1',
      PINECONE_INDEX_1_NAMESPACES: 'a,b',
      PINECONE_INDEX_2_NAME: 'idx2',
      PINECONE_INDEX_2_NAMESPACES: 'x',
      // leave index_3 undefined
    })
    const { pineconeConfig } = await importPinecone()
    expect(pineconeConfig.isConfigured).toBe(true)
    expect(pineconeConfig.getIndexNames()).toEqual(['idx1', 'idx2'])
    expect(pineconeConfig.getAllIndexNamespaceCombinations()).toEqual([
      'idx1/a',
      'idx1/b',
      'idx2/x',
    ])
  })
})
