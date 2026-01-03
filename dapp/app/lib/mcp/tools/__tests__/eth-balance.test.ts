
// Hoisted bag for anything referenced by vi.mock factories
const H = vi.hoisted(() => ({
  logger: { info: vi.fn(), error: vi.fn() },
  isValidAddressMock: vi.fn(),
  isSupportedChainMock: vi.fn(),
  getRpcUrlMock: vi.fn(),
  formatChainNameMock: vi.fn(),
  getBalanceMock: vi.fn(),
  formatEtherMock: vi.fn(),
}))

// Mocks (use only hoisted values) - fixed paths
vi.mock('@logger', () => ({ createLogger: () => H.logger }))
vi.mock('../../utils/chains', () => ({
  getRpcUrl: (...a: any[]) => H.getRpcUrlMock(...a),
  isValidAddress: (...a: any[]) => H.isValidAddressMock(...a),
  formatChainName: (...a: any[]) => H.formatChainNameMock(...a),
}))
vi.mock('../../utils/rpc', () => ({
  getBalance: (...a: any[]) => H.getBalanceMock(...a),
  formatEther: (...a: any[]) => H.formatEtherMock(...a),
}))
vi.mock('@schemas/domain/chains', () => ({
  isSupportedChain: (...a: any[]) => H.isSupportedChainMock(...a),
}))

// ✅ Import AFTER mocks, ONCE. Do NOT call vi.resetModules().
import ethBalanceToolDef from '../eth-balance'

describe('eth-balance tool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    H.isValidAddressMock.mockReturnValue(true)
    H.isSupportedChainMock.mockReturnValue(true)
    H.getRpcUrlMock.mockReturnValue('https://rpc.test')
    H.formatChainNameMock.mockImplementation((c: any) => String(c))
    H.getBalanceMock.mockResolvedValue(1000000000000000000n) // 1e18
    H.formatEtherMock.mockReturnValue('1.0')
  })

  it('happy path returns both text + json, with correct symbol (polygon -> MATIC)', async () => {
    const res = await ethBalanceToolDef.handler({
      address: '0x1111111111111111111111111111111111111111',
      chain: 'polygon',
    } as any)

    const textItem = res.content.find((c: any) => c.type === 'text')
    expect(textItem?.text).toContain('has a balance of 1.0 MATIC')

    const jsonItem = res.content.find((c: any) => c.type === 'json')
    expect(jsonItem?.data).toMatchObject({
      address: '0x1111111111111111111111111111111111111111',
      chain: 'polygon',
      chainName: 'polygon',
      balanceWei: '1000000000000000000',
      balanceEth: '1.0',
      symbol: 'MATIC',
    })

    expect(H.getRpcUrlMock).toHaveBeenCalledWith('polygon')
    expect(H.getBalanceMock).toHaveBeenCalledWith(
      'https://rpc.test',
      '0x1111111111111111111111111111111111111111'
    )
  })

  it('invalid address throws ToolFailure (by marker)', async () => {
    H.isValidAddressMock.mockReturnValue(false)
    await expect(ethBalanceToolDef.handler({ address: 'nope' } as any)).rejects.toMatchObject({
      name: 'ToolFailure',
      isToolFailure: true,
    })
  })

  it('unsupported chain throws ToolFailure (by marker)', async () => {
    H.isSupportedChainMock.mockReturnValue(false)
    await expect(
      ethBalanceToolDef.handler({
        address: '0x0000000000000000000000000000000000000000',
        chain: 'unknown',
      } as any)
    ).rejects.toMatchObject({
      name: 'ToolFailure',
      isToolFailure: true,
    })
  })

  it('rpc error returns error result shape (caught)', async () => {
    H.getBalanceMock.mockRejectedValue(new Error('rpc down'))
    const res = await ethBalanceToolDef.handler({
      address: '0x1111111111111111111111111111111111111111',
      chain: 'mainnet',
    } as any)

    expect(res.isError).toBe(true)
    expect(res.content?.[0]).toEqual({ type: 'text', text: 'rpc down' })
  })
})