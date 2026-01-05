// dapp/app/lib/llm/modes/__tests__/composeWelcome.test.ts
const { getModeConfigMock } = vi.hoisted(() => ({
  getModeConfigMock: vi.fn(),
}))

const { getStateMock, setBattleFormData } = vi.hoisted(() => {
  const state = {
    battleFormData: {
      user: {},
      chatbot: {},
    },
  }

  return {
    getStateMock: () => state,
    setBattleFormData: (next: { user: Record<string, string>; chatbot: Record<string, string> }) => {
      state.battleFormData = next
    },
  }
})

vi.mock('../configs', () => ({
  getModeConfig: getModeConfigMock,
}))

vi.mock('@store/chatModeStore', () => ({
  useChatModeStore: {
    getState: getStateMock,
  },
}))

import { composeWelcomeMessage } from '../composeWelcome'

describe('composeWelcomeMessage', () => {
  beforeEach(() => {
    getModeConfigMock.mockReset()
    setBattleFormData({ user: {}, chatbot: {} })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null for choose mode without calling config lookup', () => {
    const result = composeWelcomeMessage('choose' as any, 'ctx')
    expect(result).toBeNull()
    expect(getModeConfigMock).not.toHaveBeenCalled()
  })

  it('returns null when config is missing', () => {
    getModeConfigMock.mockReturnValue(null)
    const result = composeWelcomeMessage('freestyle' as any, 'ctx')
    expect(result).toBeNull()
  })

  it('adds a background section for rapBattle when form data exists', () => {
    getModeConfigMock.mockReturnValue({
      buildWelcome: vi.fn().mockReturnValue('WELCOME'),
    })
    setBattleFormData({
      user: {
        favoriteBlockchains: 'Ethereum',
      },
      chatbot: {
        careerJobTitles: 'Battle rapper',
      },
    })

    const result = composeWelcomeMessage(
      'rapBattle' as any,
      '{"ensName":"alice.eth"}'
    )

    expect(result).toContain('WELCOME')
    expect(result).toContain('## Background')
    expect(result).toContain('### RapBotRito')
    expect(result).toContain('Career/Job titles: Battle rapper')
    expect(result).toContain('### alice.eth')
    expect(result).toContain('Favorite blockchain(s): Ethereum')
  })

  it('returns base welcome when no form data exists', () => {
    getModeConfigMock.mockReturnValue({
      buildWelcome: vi.fn().mockReturnValue('WELCOME'),
    })
    setBattleFormData({ user: {}, chatbot: {} })

    const result = composeWelcomeMessage('rapBattle' as any)

    expect(result).toBe('WELCOME')
  })

  it('returns null when buildWelcome throws', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    getModeConfigMock.mockReturnValue({
      buildWelcome: vi.fn(() => {
        throw new Error('boom')
      }),
    })

    const result = composeWelcomeMessage('rapBattle' as any)

    expect(result).toBeNull()
    expect(errorSpy).toHaveBeenCalledWith(
      'Error building welcome message:',
      expect.any(Error)
    )
  })
})
