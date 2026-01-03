// @vitest-environment happy-dom

export {} // Make this file a module to avoid global scope conflicts

// Local env helpers (keeps this file independent of hoisted mocks)
const resetEnv = (extraKeys: string[] = []) => {
  const KEYS = [
    'NODE_ENV',
    'NEXT_PUBLIC_ACTIVE_CHAIN',
    'NEXT_PUBLIC_DOMAIN',
    'NEXT_PUBLIC_ALCHEMY_API_KEY',
    // ritonet specifics
    'NEXT_PUBLIC_LOCAL_CHAIN_ID',
    'NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME',
    'NEXT_PUBLIC_LOCAL_BLOCKCHAIN_EXPLORER_URL',
    'NEXT_PUBLIC_LOCAL_BLOCKCHAIN_EXPLORER_NAME',
    'NEXT_PUBLIC_LOCAL_BLOCKCHAIN_RPC',
    'NEXT_PUBLIC_LOCAL_BLOCKCHAIN_WSS',
  ]
  for (const k of [...KEYS, ...extraKeys]) delete process.env[k]
}

const seedBase = (overrides: Partial<NodeJS.ProcessEnv> = {}) => {
  resetEnv()
  Object.assign(process.env, {
    NODE_ENV: 'test',
    NEXT_PUBLIC_DOMAIN: 'localhost:3000',
    // default active chain
    NEXT_PUBLIC_ACTIVE_CHAIN: 'sepolia',
    ...overrides,
  })
}

const importChain = async () => {
  vi.resetModules()
  // ensure public.env picks up the env every time
  await import('../public.env')
  return await import('../chain')
}

describe('chain.ts', () => {
  beforeEach(() => {
    seedBase()
  })

  it('sepolia without Alchemy uses public RPC and no WSS', async () => {
    seedBase({
      NEXT_PUBLIC_ACTIVE_CHAIN: 'sepolia',
      NEXT_PUBLIC_ALCHEMY_API_KEY: '', // ensure absent
    })
    const chain = await importChain()
    const cfg = chain.getChainConfig('sepolia')
    expect(cfg.chainId).toBe(11155111)
    expect(cfg.name).toBe('Sepolia')
    expect(cfg.rpcUrl).toBe('https://rpc.sepolia.org')
    expect(cfg.wssUrl).toBeUndefined()
    expect(cfg.explorerUrl).toBe('https://sepolia.etherscan.io')
    expect(cfg.isTestnet).toBe(true)
  })

  it('sepolia with Alchemy uses Alchemy HTTP and WSS URLs', async () => {
    seedBase({
      NEXT_PUBLIC_ACTIVE_CHAIN: 'sepolia',
      NEXT_PUBLIC_ALCHEMY_API_KEY: 'alk',
    })
    const chain = await importChain()
    const cfg = chain.getChainConfig('sepolia')
    expect(cfg.rpcUrl).toBe('https://eth-sepolia.g.alchemy.com/v2/alk')
    expect(cfg.wssUrl).toBe('wss://eth-sepolia.g.alchemy.com/v2/alk')
  })

  it('ethereum mainnet without Alchemy uses Cloudflare RPC and no WSS', async () => {
    seedBase({
      NEXT_PUBLIC_ACTIVE_CHAIN: 'ethereum',
      NEXT_PUBLIC_ALCHEMY_API_KEY: '',
    })
    const chain = await importChain()
    const cfg = chain.getChainConfig('ethereum')
    expect(cfg.chainId).toBe(1)
    expect(cfg.name).toBe('Ethereum')
    expect(cfg.rpcUrl).toBe('https://cloudflare-eth.com')
    expect(cfg.wssUrl).toBeUndefined()
    expect(cfg.explorerUrl).toBe('https://etherscan.io')
    expect(cfg.isTestnet).toBe(false)
  })

  it('ethereum with Alchemy uses Alchemy HTTP and WSS URLs', async () => {
    seedBase({
      NEXT_PUBLIC_ACTIVE_CHAIN: 'ethereum',
      NEXT_PUBLIC_ALCHEMY_API_KEY: 'alk',
    })
    const chain = await importChain()
    const cfg = chain.getChainConfig('ethereum')
    expect(cfg.rpcUrl).toBe('https://eth-mainnet.g.alchemy.com/v2/alk')
    expect(cfg.wssUrl).toBe('wss://eth-mainnet.g.alchemy.com/v2/alk')
  })

  it('ritonet fails during public env validation when required RPC/WSS are missing', async () => {
    seedBase({
      NEXT_PUBLIC_ACTIVE_CHAIN: 'ritonet',
      NEXT_PUBLIC_LOCAL_CHAIN_ID: '90999999',
      // Missing RPC/WSS intentionally; public.env should throw on import
    })
    await expect(importChain()).rejects.toThrow(/Public environment validation failed:/i)
  })

  it('ritonet returns full config when all required fields provided', async () => {
    seedBase({
      NEXT_PUBLIC_ACTIVE_CHAIN: 'ritonet',
      NEXT_PUBLIC_LOCAL_CHAIN_ID: '90999999',
      NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME: 'RitoNet',
      NEXT_PUBLIC_LOCAL_BLOCKCHAIN_RPC: 'https://localhost:8545',
      NEXT_PUBLIC_LOCAL_BLOCKCHAIN_WSS: 'wss://localhost:8546',
      NEXT_PUBLIC_LOCAL_BLOCKCHAIN_EXPLORER_URL: 'https://localhost:3001',
      NEXT_PUBLIC_LOCAL_BLOCKCHAIN_EXPLORER_NAME: 'RitoNet Explorer',
    })
    const chain = await importChain()
    const cfg = chain.getChainConfig('ritonet')
    expect(cfg.chainId).toBe(90999999)
    expect(cfg.name).toBe('RitoNet')
    expect(cfg.rpcUrl).toBe('https://localhost:8545')
    expect(cfg.wssUrl).toBe('wss://localhost:8546')
    expect(cfg.explorerUrl).toBe('https://localhost:3001')
    expect(cfg.explorerName).toBe('RitoNet Explorer')
    expect(cfg.isTestnet).toBe(true)
  })

  it('getTargetChainId/getActiveChain reflect the active chain', async () => {
    // sepolia
    seedBase({ NEXT_PUBLIC_ACTIVE_CHAIN: 'sepolia' })
    let chain = await importChain()
    expect(chain.getActiveChain()).toBe('sepolia')
    expect(chain.getTargetChainId()).toBe(11155111)

    // ethereum
    seedBase({ NEXT_PUBLIC_ACTIVE_CHAIN: 'ethereum' })
    chain = await importChain()
    expect(chain.getActiveChain()).toBe('ethereum')
    expect(chain.getTargetChainId()).toBe(1)

    // ritonet with custom id (falls back to default when not set)
    seedBase({
      NEXT_PUBLIC_ACTIVE_CHAIN: 'ritonet',
      NEXT_PUBLIC_LOCAL_CHAIN_ID: '123456',
      NEXT_PUBLIC_LOCAL_BLOCKCHAIN_RPC: 'https://localhost:8545',
      NEXT_PUBLIC_LOCAL_BLOCKCHAIN_WSS: 'wss://localhost:8546',
    })
    chain = await importChain()
    expect(chain.getActiveChain()).toBe('ritonet')
    expect(chain.getTargetChainId()).toBe(123456)
  })

  it('getChainDisplayName Title-Cases and isTestnet reflects chain type', async () => {
    seedBase({ NEXT_PUBLIC_ACTIVE_CHAIN: 'ethereum' })
    const chain = await importChain()
    expect(chain.getChainDisplayName('ethereum')).toBe('Ethereum')
    expect(chain.getChainDisplayName('sepolia')).toBe('Sepolia')
    expect(chain.getChainDisplayName('ritonet')).toBe('Ritonet')

    expect(chain.isTestnet('ethereum')).toBe(false)
    expect(chain.isTestnet('sepolia')).toBe(true)
    expect(chain.isTestnet('ritonet')).toBe(true)
  })

  it('getSupportedChains returns all supported chain types', async () => {
    const chain = await importChain()
    expect(chain.getSupportedChains()).toEqual(['ethereum', 'sepolia', 'ritonet'])
  })
})
