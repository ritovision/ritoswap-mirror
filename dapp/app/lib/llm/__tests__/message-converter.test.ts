// dapp/app/lib/llm/__tests__/message-converter.test.ts

// Mock @langchain/core/messages with minimal behavior we rely on
vi.mock('@langchain/core/messages', () => {
  class Base {
    content: any
    constructor(content: any) { this.content = content }
    _getType(): string { return 'base' }
  }
  class HumanMessage extends Base {
    _getType() { return 'human' }
  }
  class SystemMessage extends Base {
    _getType() { return 'system' }
  }
  class AIMessage extends Base {
    _getType() { return 'ai' }
  }

  return {
    BaseMessage: Base, // not used at runtime here, but provided for completeness
    HumanMessage,
    SystemMessage,
    AIMessage,
  }
})

import {
  contentToText,
  convertUiToModelMessages,
  buildSystemPrompt,
  summarizeMessages,
} from '../message-converter'

describe('contentToText', () => {
  it('returns the string as-is', () => {
    expect(contentToText('hello')).toBe('hello')
  })

  it('joins array parts, picking .text/.delta or raw strings', () => {
    const input = [
      'A',
      { text: 'B' },
      { delta: 'C' },
      { text: 123 }, // ignored
      null,
      {},
      'D',
    ]
    expect(contentToText(input)).toBe('ABCD')
  })

  it('returns object.text when it is a string', () => {
    expect(contentToText({ text: 'hi' })).toBe('hi')
  })

  it('returns empty string for unsupported shapes', () => {
    expect(contentToText(42 as any)).toBe('')
    expect(contentToText({ text: 42 } as any)).toBe('')
    expect(contentToText(undefined as any)).toBe('')
  })
})

describe('convertUiToModelMessages', () => {
  const SYNTH = 'SYNTHESIZED_SYSTEM'

  it('uses existing system message (content field) and converts user/assistant', () => {
    const ui = [
      { role: 'system', content: [{ text: 'Custom System ' }, { delta: 'Msg' }] },
      { role: 'user', parts: [{ text: 'Hello' }, { delta: '!' }] },
      { role: 'assistant', text: 'Okay' },
    ]

    const result = convertUiToModelMessages(ui as any, SYNTH)

    expect(result.map(m => m._getType())).toEqual(['system', 'human', 'ai'])
    expect(result.map(m => m.content)).toEqual([
      'Custom System Msg',
      'Hello!',
      'Okay',
    ])
  })

  it('falls back to synthesized system when none provided, and skips unknown roles', () => {
    const ui = [
      { role: 'user', content: 'hey' },
      { role: 'weird-role', content: 'ignore me' },
      { role: 'assistant', parts: [{ text: 'yo' }] },
    ]

    const result = convertUiToModelMessages(ui as any, SYNTH)

    expect(result.map(m => m._getType())).toEqual(['system', 'human', 'ai'])
    expect(result.map(m => m.content)).toEqual([SYNTH, 'hey', 'yo'])
  })

  it('extracts from content/parts/text in that order and tolerates empties', () => {
    const ui = [
      { role: 'system', parts: [{ delta: 'Sys' }] }, // will become 'Sys'
      { role: 'user', text: 'U' },
      { role: 'assistant', content: [{ text: 'A' }, { delta: 'I' }] },
    ]

    const result = convertUiToModelMessages(ui as any, SYNTH)
    expect(result.map(m => m._getType())).toEqual(['system', 'human', 'ai'])
    expect(result.map(m => m.content)).toEqual(['Sys', 'U', 'AI'])
  })
})

describe('buildSystemPrompt', () => {
  const DEFAULT = 'DEFAULT_SYSTEM'

  it('returns client-provided system text when present (ignores metadata)', () => {
    const ui = [
      { role: 'system', parts: [{ text: 'ClientSys' }] },
      { role: 'user', content: 'hi' },
    ]
    const metadata = { nftContext: { a: 1 }, nftHumanSummary: 'context' }

    const prompt = buildSystemPrompt(ui as any, metadata, DEFAULT)
    expect(prompt).toBe('ClientSys')
  })

  it('builds composite prompt with NFT context when no system provided', () => {
    const ui: any[] = [{ role: 'user', content: 'hi' }]
    const metadata = {
      nftContext: { collection: 'CoolCats', floor: 1.23 },
      nftHumanSummary: 'Fun, blue cats.',
    }

    const prompt = buildSystemPrompt(ui as any, metadata, DEFAULT)
    expect(prompt).toBe(
      `${DEFAULT}\n` +
      `NFT_CONTEXT_JSON:\n${JSON.stringify(metadata.nftContext)}\n` +
      `NFT_CONTEXT_HUMAN:\n${metadata.nftHumanSummary}`
    )
  })

  it('omits non-string nftHumanSummary gracefully', () => {
    const ui: any[] = [{ role: 'assistant', content: 'ok' }]
    const metadata = { nftContext: { x: true }, nftHumanSummary: { not: 'string' } }

    const prompt = buildSystemPrompt(ui as any, metadata, DEFAULT)
    expect(prompt).toBe(
      `${DEFAULT}\n` +
      `NFT_CONTEXT_JSON:\n${JSON.stringify(metadata.nftContext)}\n` +
      `NFT_CONTEXT_HUMAN:\n`
    )
  })

  it('returns default system when neither system nor metadata.nftContext present', () => {
    const ui: any[] = [{ role: 'user', content: 'hi' }]
    const prompt = buildSystemPrompt(ui as any, {}, DEFAULT)
    expect(prompt).toBe(DEFAULT)
  })
})

describe('summarizeMessages', () => {
  it('summarizes list (total, first, last, types + lengths)', () => {
    const ui = [
      { role: 'system', content: 'Sys' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'World!' },
    ]
    const messages = convertUiToModelMessages(ui as any, 'SYNTH')
    const summary = summarizeMessages(messages)

    expect(summary.total).toBe(3)
    expect(summary.first).toBe('system')
    expect(summary.last).toBe('ai')
    expect(summary.types).toEqual([
      { type: 'system', len: 'Sys'.length },
      { type: 'human',  len: 'Hello'.length },
      { type: 'ai',     len: 'World!'.length },
    ])
  })

  it('handles empty array', () => {
    const summary = summarizeMessages([])
    expect(summary.total).toBe(0)
    expect(summary.first).toBeUndefined()
    expect(summary.last).toBeUndefined()
    expect(summary.types).toEqual([])
  })
})
