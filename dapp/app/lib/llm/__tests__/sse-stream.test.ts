
vi.mock('@logger', () => {
  const noop = vi.fn()
  return { createLogger: () => ({ warn: noop, error: noop, info: noop, debug: noop }) }
})

import { sseInit } from '../sse-stream'

const td = new TextDecoder()
async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const r = stream.getReader()
  let out = ''
  for (;;) {
    const { value, done } = await r.read()
    if (done) break
    out += td.decode(value, { stream: true })
  }
  return out
}

describe('sseInit (extra cases)', () => {
  it('done() emits [DONE] but does not close; more events can follow until finish()', async () => {
    const { stream, parts, isClosed } = sseInit()

    parts.start('m2')
    parts.textStart('t2')
    parts.textDelta('t2', 'A')
    parts.done() // first [DONE], stream still open
    expect(isClosed()).toBe(false)

    // still able to send after done()
    parts.textDelta('t2', 'B')
    parts.textEnd('t2')

    // now finish (adds finish + [DONE] and closes)
    parts.finish()

    const text = await readAll(stream)
    expect(text).toContain('data: {"type":"start","messageId":"m2"}\n\n')
    expect(text).toContain('data: {"type":"text-start","id":"t2"}\n\n')
    expect(text).toContain('data: {"type":"text-delta","id":"t2","delta":"A"}\n\n')
    expect(text).toContain('data: [DONE]\n\n') // from done()
    expect(text).toContain('data: {"type":"text-delta","id":"t2","delta":"B"}\n\n')
    expect(text).toContain('data: {"type":"text-end","id":"t2"}\n\n')
    expect(text).toContain('data: {"type":"finish"}\n\n')
    // a second [DONE] from finish()
    expect(text.match(/data: \[DONE]\n\n/g)).toHaveLength(2)
    expect(isClosed()).toBe(true)
  })

  it('finish() is idempotent/safe when called multiple times', async () => {
    const { stream, parts, isClosed } = sseInit()
    parts.start('x')
    parts.finish()
    const before = await readAll(stream)

    // Call again; should be a no-op and not throw
    expect(() => parts.finish()).not.toThrow()
    expect(isClosed()).toBe(true)

    // Ensure no new frames were added by second call
    expect(before.match(/data:/g)?.length ?? 0).toBeGreaterThan(0)
  })

  it('tool input/output events serialize expected shapes', async () => {
    const { stream, parts } = sseInit()

    parts.toolInputStart('tc1', 'search')
    parts.toolInputDelta('tc1', 'q=')
    parts.toolInputAvailable('tc1', 'search', { q: 'cats' })
    parts.toolInputError('tc1', 'bad input')
    parts.toolOutputAvailable('tc1', { results: [1, 2] })
    parts.toolOutputError('tc1', 'timeout')
    parts.finish()

    const text = await readAll(stream)
    expect(text).toContain('data: {"type":"tool-input-start","toolCallId":"tc1","toolName":"search"}\n\n')
    expect(text).toContain('data: {"type":"tool-input-delta","toolCallId":"tc1","inputTextDelta":"q="}\n\n')
    expect(text).toContain('data: {"type":"tool-input-available","toolCallId":"tc1","toolName":"search","input":{"q":"cats"}}\n\n')
    expect(text).toContain('data: {"type":"tool-input-error","toolCallId":"tc1","errorText":"bad input"}\n\n')
    expect(text).toContain('data: {"type":"tool-output-available","toolCallId":"tc1","output":{"results":[1,2]}}\n\n')
    expect(text).toContain('data: {"type":"tool-output-error","toolCallId":"tc1","errorText":"timeout"}\n\n')
  })

  it('error() emits an error frame and still allows finish()', async () => {
    const { stream, parts } = sseInit()
    parts.error('oops')
    parts.finish()
    const text = await readAll(stream)

    expect(text).toContain('data: {"type":"error","errorText":"oops"}\n\n')
    expect(text).toContain('data: {"type":"finish"}\n\n')
  })
})
