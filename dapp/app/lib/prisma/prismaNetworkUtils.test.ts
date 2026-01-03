// app/lib/prisma/prismaNetworkUtils.test.ts
import {
  resetModulesAndSeed,
  seedEthereum,
  seedSepolia,
  seedRitonet,
} from '@/test/helpers/env'

// ─── Hoisted PrismaClient mock ───────────────────────────────────────────────
// This replaces new PrismaClient() inside prismaNetworkUtils.ts
vi.mock('@prisma/client', () => {
  class FakePrisma {
    tokenRitonet = { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() }
    tokenSepolia = { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() }
    tokenEthereum = { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() }
  }
  return { PrismaClient: FakePrisma }
})

let getTokenModel: any
let getChainConfig: any
let prisma: any

async function reloadUtils() {
  vi.resetModules()
  ;({ getTokenModel, getChainConfig } = await import('./prismaNetworkUtils'))
  ;({ prisma } = await import('./prisma'))
}

function resetPrismaSpies() {
  const delegates = ['tokenRitonet', 'tokenSepolia', 'tokenEthereum'] as const
  for (const d of delegates) {
    prisma[d].findUnique.mockReset()
    prisma[d].findMany.mockReset()
    prisma[d].upsert.mockReset()
  }
}

describe('getTokenModel()', () => {
  beforeEach(async () => {
    resetModulesAndSeed()
    await reloadUtils()
    resetPrismaSpies()
  })

  it('routes to tokenRitonet when chain = ritonet', async () => {
    resetModulesAndSeed(seedRitonet)
    await reloadUtils()
    const model = getTokenModel()

    await model.findUnique({ where: { tokenId: 1 } })
    expect(prisma.tokenRitonet.findUnique).toHaveBeenCalled()
  })

  it('routes to tokenSepolia when chain = sepolia', async () => {
    resetModulesAndSeed(seedSepolia)
    await reloadUtils()
    const model = getTokenModel()

    await model.findUnique({ where: { tokenId: 2 } })
    expect(prisma.tokenSepolia.findUnique).toHaveBeenCalled()
  })

  it('routes to tokenEthereum when chain = ethereum', async () => {
    resetModulesAndSeed(seedEthereum)
    await reloadUtils()
    const model = getTokenModel()

    await model.findUnique({ where: { tokenId: 3 } })
    expect(prisma.tokenEthereum.findUnique).toHaveBeenCalled()
  })
})

describe('getChainConfig()', () => {
  beforeEach(async () => {
    resetModulesAndSeed()
    await reloadUtils()
  })

  it('returns RitoNet config', async () => {
    resetModulesAndSeed(seedRitonet)
    await reloadUtils()
    const cfg = getChainConfig()
    expect(cfg.chainId).toBe(90999999)
    expect(cfg.name).toBe('RitoNet')
    expect(cfg.rpcUrl).toBe('https://localhost:8545')
    expect(cfg.wssUrl).toBe('wss://localhost:8546')
  })

  it('returns Sepolia config', async () => {
    resetModulesAndSeed(seedSepolia)
    process.env.NEXT_PUBLIC_ALCHEMY_API_KEY = 'MY_ALCHEMY_KEY'
    await reloadUtils()
    const cfg = getChainConfig()
    const expected = `https://eth-sepolia.g.alchemy.com/v2/MY_ALCHEMY_KEY`
    expect(cfg.chainId).toBe(11155111)
    expect(cfg.name).toBe('Sepolia')
    expect(cfg.rpcUrl).toBe(expected)
  })

  it('returns Ethereum config', async () => {
    resetModulesAndSeed(seedEthereum)
    process.env.NEXT_PUBLIC_ALCHEMY_API_KEY = 'MY_ALCHEMY_KEY'
    await reloadUtils()
    const cfg = getChainConfig()
    const expected = `https://eth-mainnet.g.alchemy.com/v2/MY_ALCHEMY_KEY`
    expect(cfg.chainId).toBe(1)
    expect(cfg.name).toBe('Ethereum')
    expect(cfg.rpcUrl).toBe(expected)
  })
})
