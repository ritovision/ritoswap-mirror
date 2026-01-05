// dapp/app/lib/llm/modes/__tests__/composePrompt.test.ts
const { getModeConfigMock } = vi.hoisted(() => ({
  getModeConfigMock: vi.fn(),
}))

vi.mock('../configs', () => ({
  getModeConfig: getModeConfigMock,
}))

import { composeSystemPrompt } from '../composePrompt'

describe('composeSystemPrompt', () => {
  beforeEach(() => {
    getModeConfigMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null for choose mode without calling config lookup', () => {
    const result = composeSystemPrompt('choose' as any, 'ctx')
    expect(result).toBeNull()
    expect(getModeConfigMock).not.toHaveBeenCalled()
  })

  it('returns null and logs when config is missing', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    getModeConfigMock.mockReturnValue(null)

    const result = composeSystemPrompt('freestyle' as any, 'ctx')

    expect(result).toBeNull()
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('No config found for mode'))
  })

  it('returns the config prompt and passes through context', () => {
    const buildPrompt = vi.fn().mockReturnValue('PROMPT')
    getModeConfigMock.mockReturnValue({ buildPrompt })

    const result = composeSystemPrompt('rapBattle' as any, 'nft')

    expect(buildPrompt).toHaveBeenCalledWith('nft')
    expect(result).toBe('PROMPT')
  })
})
