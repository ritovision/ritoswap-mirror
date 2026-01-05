// dapp/app/lib/client/__tests__/mint.client.test.ts
import { type Mock } from 'vitest'

// Mock contracts used by the action creators
vi.mock('@config/contracts', () => ({
  KEY_TOKEN_ADDRESS: '0xDeaDbeefDeaDbeefDeaDbeefDeaDbeefDeaDbeef',
  fullKeyTokenAbi: ['mock-abi'] as unknown as any[],
}))

// Mock the notifications facade used by mint.client
vi.mock('@/app/lib/notifications', () => {
  const sendNotificationEvent = vi.fn()
  const sendErrorNotification = vi.fn()
  return {
    sendNotificationEvent,
    sendErrorNotification,
  }
})

// Import after mocks
import {
  createMintAction,
  createBurnAction,
  formatMintError,
  formatBurnError,
  handleMintSuccess,
  handleBurnSuccess,
  validateTokenId,
  getTransactionStatus,
  TRANSACTION_RETRY_CONFIG,
  estimateGasBuffer,
} from '../mint.client'
import { KEY_TOKEN_ADDRESS, fullKeyTokenAbi } from '@config/contracts'
import { sendNotificationEvent, sendErrorNotification } from '@/app/lib/notifications'

const asMock = (fn: unknown) => fn as unknown as Mock

describe('mint.client', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    logSpy.mockClear()
  })

  it('createMintAction returns correct write params', () => {
    const action = createMintAction()
    expect(action.address).toBe(KEY_TOKEN_ADDRESS)
    expect(action.abi).toBe(fullKeyTokenAbi)
    expect(action.functionName).toBe('mint')
    expect('args' in action).toBe(false)
  })

  it('createBurnAction returns correct write params with bigint arg', () => {
    const actionNum = createBurnAction(7)
    expect(actionNum.address).toBe(KEY_TOKEN_ADDRESS)
    expect(actionNum.abi).toBe(fullKeyTokenAbi)
    expect(actionNum.functionName).toBe('burn')
    expect(actionNum.args).toEqual([7n])

    const actionStr = createBurnAction('42')
    expect(actionStr.args).toEqual([42n])
  })

  it('formatMintError maps known messages, emits events, and falls back', () => {
    expect(formatMintError(new Error('user rejected'))).toBe('Transaction cancelled')
    expect(sendNotificationEvent).toHaveBeenCalledWith('TRANSACTION_CANCELLED')

    asMock(sendNotificationEvent).mockClear()
    expect(formatMintError(new Error('insufficient funds'))).toBe('Insufficient funds for minting')
    expect(sendNotificationEvent).toHaveBeenCalledWith('INSUFFICIENT_FUNDS')

    asMock(sendNotificationEvent).mockClear()
    expect(formatMintError(new Error('already minted'))).toBe('You already own an NFT')
    expect(sendNotificationEvent).toHaveBeenCalledWith('ALREADY_MINTED')

    asMock(sendNotificationEvent).mockClear()
    expect(formatMintError(new Error('weird'))).toBe('Failed to mint NFT: weird')
    expect(sendErrorNotification).toHaveBeenCalledWith('Failed to mint NFT: weird')
  })

  it('formatBurnError maps known messages, emits events, and falls back', () => {
    expect(formatBurnError(new Error('user rejected'))).toBe('Transaction cancelled')
    expect(sendNotificationEvent).toHaveBeenCalledWith('TRANSACTION_CANCELLED')

    asMock(sendNotificationEvent).mockClear()
    expect(formatBurnError(new Error('not owner'))).toBe('You are not the owner of this NFT')
    expect(sendNotificationEvent).toHaveBeenCalledWith('NOT_TOKEN_OWNER')

    asMock(sendNotificationEvent).mockClear()
    expect(formatBurnError(new Error('token does not exist'))).toBe('Token does not exist')
    expect(sendErrorNotification).toHaveBeenCalledWith('Token does not exist')

    asMock(sendErrorNotification).mockClear()
    expect(formatBurnError(new Error('other'))).toBe('Failed to burn NFT: other')
    expect(sendErrorNotification).toHaveBeenCalledWith('Failed to burn NFT: other')
  })

  it('handleMintSuccess logs hash (toasts handled elsewhere)', () => {
    handleMintSuccess('0xMINTED')
    expect(logSpy).toHaveBeenCalledWith('Mint transaction:', '0xMINTED')
  })

  it('handleBurnSuccess logs hash (toasts handled elsewhere)', () => {
    handleBurnSuccess('0xBURNED')
    expect(logSpy).toHaveBeenCalledWith('Burn transaction:', '0xBURNED')
  })

  it('validateTokenId handles empty/invalid/valid values and emits notifications', () => {
    // empty
    expect(validateTokenId(null)).toBe(false)
    expect(sendErrorNotification).toHaveBeenCalledWith('No token ID available for burning')

    // invalid
    asMock(sendNotificationEvent).mockClear()
    asMock(sendErrorNotification).mockClear()
    expect(validateTokenId('abc')).toBe(false)
    expect(sendNotificationEvent).toHaveBeenCalledWith('INVALID_TOKEN_ID')

    // valid
    asMock(sendNotificationEvent).mockClear()
    asMock(sendErrorNotification).mockClear()
    expect(validateTokenId('123')).toBe(true)
    expect(validateTokenId(123)).toBe(true)
    expect(validateTokenId('0x10')).toBe(true)
    expect(sendNotificationEvent).not.toHaveBeenCalled()
    expect(sendErrorNotification).not.toHaveBeenCalled()
  })

  it('getTransactionStatus shapes flags and error correctly', () => {
    const ok = getTransactionStatus(true, false, false, null)
    expect(ok).toEqual({
      isPending: true,
      isConfirming: false,
      isSuccess: false,
      isError: false,
      hash: undefined,
    })

    const err = getTransactionStatus(false, false, false, new Error('x'))
    expect(err.isError).toBe(true)
    expect(err.hash).toBeUndefined()
  })

  it('estimateGasBuffer adds 20% buffer', () => {
    expect(estimateGasBuffer(1000n)).toBe(1200n)
    expect(estimateGasBuffer(1n)).toBe(1n) // integer division
  })

  it('TRANSACTION_RETRY_CONFIG matches expected defaults', () => {
    expect(TRANSACTION_RETRY_CONFIG).toEqual({
      maxRetries: 3,
      retryDelay: 1000,
      confirmationBlocks: 2,
      confirmationTimeout: 60000,
    })
  })
})
