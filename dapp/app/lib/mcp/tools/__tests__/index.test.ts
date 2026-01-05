// mutable config objects exposed by mocks so we can flip flags per test
const hoisted = vi.hoisted(() => ({
  aiConfig: { provider: 'openai', secrets: { aiPrivateKey: 'X', openaiApiKey: 'Y' } } as any,
  pineConfig: { isConfigured: true } as any,
  makeTool: (name: string) => ({
    tool: { name, description: '', inputSchema: {} },
    handler: vi.fn(async () => ({ content: [] })),
  }),
}))

vi.mock('@config/ai.server', () => ({ aiServerConfig: hoisted.aiConfig }))
vi.mock('@config/pinecone.config', () => ({ pineconeConfig: hoisted.pineConfig }))

vi.mock('../eth-balance', () => ({ default: hoisted.makeTool('get_eth_balance') }))
vi.mock('../keynft-read', () => ({ default: hoisted.makeTool('keynft_read') }))
vi.mock('../send-crypto', () => ({ default: hoisted.makeTool('send_crypto') }))
vi.mock('../mark-key-used', () => ({ default: hoisted.makeTool('mark_key_used') }))
vi.mock('../pinecone-search', () => ({ default: hoisted.makeTool('pinecone_search') }))
vi.mock('../send-crypto-agent', () => ({ default: hoisted.makeTool('send_crypto_agent') }))
vi.mock('../image-generate-workflow', () => ({ default: hoisted.makeTool('image_generate_workflow') }))
vi.mock('../agent-rap-verse', () => ({ default: hoisted.makeTool('agent_rap_verse') }))
vi.mock('../keynft-manage', () => ({ default: hoisted.makeTool('keynft_manage') }))
vi.mock('../keynft-used-count', () => ({ default: hoisted.makeTool('keynft_used_count') }))

import { ToolRegistry } from '../index'

describe('ToolRegistry (index.ts)', () => {
  beforeEach(() => {
    hoisted.aiConfig.provider = 'openai'
    hoisted.aiConfig.secrets = { aiPrivateKey: 'X', openaiApiKey: 'Y' }
    hoisted.pineConfig.isConfigured = true
  })

  it('registers unconditional tools', () => {
    const r = new ToolRegistry()
    expect(r.has('get_eth_balance')).toBe(true)
    expect(r.has('keynft_read')).toBe(true)
    expect(r.has('mark_key_used')).toBe(true)
    expect(r.has('keynft_used_count')).toBe(true)
    expect(r.has('image_generate_workflow')).toBe(true)
  })

  it('registers tools gated by aiPrivateKey', () => {
    const r = new ToolRegistry()
    expect(r.has('send_crypto')).toBe(true)
    expect(r.has('send_crypto_agent')).toBe(true)
    expect(r.has('keynft_manage')).toBe(true)
  })

  it('omits aiPrivateKey-gated tools when missing', () => {
    hoisted.aiConfig.secrets = { openaiApiKey: 'ONLY' }
    const r = new ToolRegistry()
    expect(r.has('send_crypto')).toBe(false)
    expect(r.has('send_crypto_agent')).toBe(false)
    expect(r.has('keynft_manage')).toBe(false)
  })

  it('registers pinecone tool only when configured', () => {
    hoisted.pineConfig.isConfigured = true
    let r = new ToolRegistry()
    expect(r.has('pinecone_search')).toBe(true)

    hoisted.pineConfig.isConfigured = false
    r = new ToolRegistry()
    expect(r.has('pinecone_search')).toBe(false)
  })

  it('registers agent_rap_verse only when openai + pinecone + provider=openai', () => {
    let r = new ToolRegistry()
    expect(r.has('agent_rap_verse')).toBe(true)

    hoisted.aiConfig.secrets = { aiPrivateKey: 'X', openaiApiKey: '' }
    r = new ToolRegistry()
    expect(r.has('agent_rap_verse')).toBe(false)

    hoisted.aiConfig.secrets = { aiPrivateKey: 'X', openaiApiKey: 'Y' }
    hoisted.pineConfig.isConfigured = false
    r = new ToolRegistry()
    expect(r.has('agent_rap_verse')).toBe(false)

    hoisted.pineConfig.isConfigured = true
    hoisted.aiConfig.provider = 'anthropic'
    r = new ToolRegistry()
    expect(r.has('agent_rap_verse')).toBe(false)
  })

  it('duplicate registration throws', () => {
    const r = new ToolRegistry()
    const dup = { tool: { name: 'get_eth_balance', description: '', inputSchema: {} }, handler: async () => ({ content: [] }) } as any
    expect(() => r.register(dup)).toThrowError(/already registered/i)
  })

  it('get / getAll / getNames / has behave as expected', () => {
    const r = new ToolRegistry()
    const names = r.getNames()
    expect(names.length).toBeGreaterThan(0)
    for (const n of names) {
      expect(r.has(n)).toBe(true)
      expect(r.get(n)?.tool?.name).toBe(n)
    }
    expect(r.getAll().length).toBe(names.length)
  })
})
