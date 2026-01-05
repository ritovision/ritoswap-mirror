// app/lib/mcp/tools/__tests__/send-crypto-agent.test.ts

// --- Mocks (must be declared before importing the SUT) ---

vi.mock('@logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// SUT imports './types' (relative to tools dir)
vi.mock('../types', () => ({
  createTool: (t: any) => t, // passthrough
}))

vi.mock('@config/ai.server', () => ({
  aiServerConfig: {
    limits: { maxOutputTokens: 200 },
    getModel: (idx: number) => `mock-model-${idx}`,
  },
}))

const getProviderMock = vi.fn()
vi.mock('@lib/llm/providers/registry', () => ({
  providerRegistry: {
    getProvider: getProviderMock,
  },
}))

const getChainConfigMock = vi.fn(() => ({ chainId: 11155111 }))
vi.mock('@config/chain', () => ({
  getChainConfig: getChainConfigMock,
}))

// SUT imports '../utils/chains' → from this test file it's ../../utils/chains
vi.mock('../../utils/chains', () => ({
  CHAIN_IDS: { sepolia: 11155111 },
  formatChainName: (key: any) => (key === 'sepolia' ? 'Sepolia' : String(key)),
}))

const findUniqueMock = vi.fn()
const getTokenModelMock = vi.fn(() => ({ findUnique: findUniqueMock }))
vi.mock('@lib/prisma/prismaNetworkUtils', () => ({
  getTokenModel: getTokenModelMock,
  prisma: {},
}))

// SUT does dynamic import('../tools') → from this test file it's ../../tools
const registryMap = new Map<string, any>()
const toolRegistryMock = {
  get: (name: string) => registryMap.get(name),
  __set(name: string, handler: (args: any) => any) {
    registryMap.set(name, { handler })
  },
  __clear() {
    registryMap.clear()
  },
}
vi.mock('../../tools', () => ({
  toolRegistry: toolRegistryMock,
}))

// --- Helpers ---

/** Deterministic Math.random sequence for persona sampling */
function setRandomSequence(vals: number[]) {
  let i = 0
  vi.spyOn(Math, 'random').mockImplementation(() => vals[i++] ?? 0.1)
}

let agent: any

beforeEach(async () => {
  vi.restoreAllMocks()
  getProviderMock.mockReset()
  getChainConfigMock.mockReset().mockReturnValue({ chainId: 11155111 })
  findUniqueMock.mockReset()
  getTokenModelMock.mockReset().mockReturnValue({ findUnique: findUniqueMock })
  toolRegistryMock.__clear()

  // default LLM: deny unless overridden by test
  getProviderMock.mockReturnValue({
    invoke: vi.fn(async () => `{"decision":"deny","reason":"Default mock deny."}`),
  })

  // dynamic import AFTER mocks
  const mod = await import('../send-crypto-agent')
  agent = mod.default
})

afterEach(() => {
  vi.restoreAllMocks()
  toolRegistryMock.__clear()
})

describe('send-crypto-agent', () => {
  it('quick-declines when persona is harsh and reason is weak (skips external checks)', async () => {
    // Set grumpy >=7 and greedy >=8
    setRandomSequence([0.78, 0.89]) // grumpy=8, greedy=9

    const toolGetSpy = vi.spyOn(toolRegistryMock, 'get')

    const res = await agent.handler({
      reason: 'pls',
      __jwt: { address: '0x1234567890abcdef1234567890abcdef12345678' },
    })

    const text = (res?.content ?? []).find((c: any) => c?.type === 'text')?.text ?? ''
    expect(text).toMatch(/Declined/i)
    expect(text).toMatch(/persona leaned harsh/i)

    const json = (res?.content ?? []).find((c: any) => c?.type === 'json')?.data
    expect(json.decision).toBe('deny')
    expect(json.considered.usedBalanceCheck).toBe(false)
    expect(json.considered.usedMembershipCheck).toBe(false)
    expect(json.trace).toContain('skipped_checks_persona+weak_reason')
    expect(json.persona.grumpy).toBeGreaterThanOrEqual(7)
    expect(json.persona.greedy).toBeGreaterThanOrEqual(8)

    // Ensure no external calls
    expect(getProviderMock).not.toHaveBeenCalled()
    expect(toolGetSpy).not.toHaveBeenCalled()
  })

  it('sends ETH when user is a valid member with unused key and LLM approves', async () => {
    // Non-harsh persona so we do the full pipeline
    setRandomSequence([0.25, 0.12]) // grumpy=3, greedy=2

    // Tools used by the agent
    toolRegistryMock.__set('get_eth_balance', async () => ({
      content: [{ type: 'json', data: { balanceEth: 0.5 } }],
    }))

    toolRegistryMock.__set('key_nft_read', async () => ({
      content: [{ type: 'json', data: { hasToken: true, tokenId: '123' } }],
    }))

    // DB membership check: token unused
    findUniqueMock.mockResolvedValue({ used: false })

    // LLM approves with amount 0.25
    getProviderMock.mockReturnValue({
      invoke: vi.fn(async () =>
        `{"decision":"send","reason":"Valid member; approving.","amountEth":0.25}`,
      ),
    })

    // Final send tool succeeds
    toolRegistryMock.__set('send_crypto_to_signed_in_user', async () => ({
      content: [
        {
          type: 'json',
          data: {
            hash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
            to: '0xAa000000000000000000000000000000000000Aa',
            from: '0xFf000000000000000000000000000000000000Ff',
            chainId: 11155111,
            network: 'Sepolia',
            explorerUrl:
              'https://sepolia.etherscan.io/tx/0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
          },
        },
        { type: 'text', text: 'ok' },
      ],
    }))

    const userAddress = '0xAa000000000000000000000000000000000000Aa'
    const res = await agent.handler({
      reason: 'I would like to test the faucet as a member.',
      __jwt: { address: userAddress },
    })

    const text = (res?.content ?? []).find((c: any) => c?.type === 'text')?.text ?? ''
    expect(text).toMatch(/Approved/i)
    expect(text).toMatch(/Sent 0\.25 ETH/i)

    const json = (res?.content ?? []).find((c: any) => c?.type === 'json')?.data
    expect(json.decision).toBe('send')
    expect(json.sentAmountEth).toBe(0.25)
    expect(json.facts.membership).toEqual({ hasKey: true, tokenId: '123', used: false })
    expect(json.considered.usedBalanceCheck).toBe(true)
    expect(json.considered.usedMembershipCheck).toBe(true)
    expect(json.agentModel).toBe('mock-model-2')
  })
})
