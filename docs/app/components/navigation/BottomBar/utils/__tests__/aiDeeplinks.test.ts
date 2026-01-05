import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildDeeplink, openAIDeeplink, type AIProvider } from '@/app/components/navigation/BottomBar/utils/aiDeeplinks'

describe('buildDeeplink', () => {
  it.each<[AIProvider, string]>([
    ['chatgpt', 'https://chat.openai.com/?q=ask%20me+https%3A%2F%2Fexample.com'],
    ['claude', 'https://claude.ai/new?q=ask%20me+https%3A%2F%2Fexample.com'],
    ['perplexity', 'https://www.perplexity.ai/search?q=ask%20me:+https%3A%2F%2Fexample.com']
  ])('creates url for %s', (provider, expected) => {
    const url = buildDeeplink(provider, 'ask me', 'https://example.com')
    expect(url).toBe(expected)
  })

  it('throws for unsupported provider', () => {
    expect(() => buildDeeplink('unsupported' as never, 'prompt', 'url')).toThrow(
      'Unknown AI provider: unsupported'
    )
  })
})

describe('openAIDeeplink', () => {
  const originalOpen = window.open

  beforeEach(() => {
    window.open = vi.fn()
  })

  afterEach(() => {
    window.open = originalOpen
    vi.restoreAllMocks()
  })

  it('opens window with computed deeplink', () => {
    openAIDeeplink('claude', 'hi', 'https://domain.test')
    expect(window.open).toHaveBeenCalledWith(
      'https://claude.ai/new?q=hi+https%3A%2F%2Fdomain.test',
      '_blank',
      'noopener,noreferrer'
    )
  })
})
