import { createTool, jsonResult, textResult, errorResult } from '../types'

describe('types helpers', () => {
  it('jsonResult/textResult/errorResult shapes', () => {
    expect(jsonResult({ ok: 1 })).toEqual({ content: [{ type: 'json', data: { ok: 1 } }] })
    expect(textResult('hi')).toEqual({ content: [{ type: 'text', text: 'hi' }] })
    expect(errorResult('bad')).toEqual({
      content: [{ type: 'text', text: 'bad' }],
      isError: true,
    })
  })

  it('createTool wraps domain tool, preserves requiresJwt flag', async () => {
    const domainTool = {
      name: 'demo',
      description: 'demo tool',
      inputSchema: { type: 'object' },
      requiresJwt: true,
      handler: vi.fn(async (args: any) => ({ content: [{ type: 'text', text: JSON.stringify(args) }] })),
    }

    const def = createTool(domainTool)

    // manifest exposed on wire
    expect(def.tool).toEqual({
      name: 'demo',
      description: 'demo tool',
      inputSchema: { type: 'object' },
    })
    // server-side flag is preserved but not on wire
    expect(def.requiresJwt).toBe(true)

    // handler passes args through
    const res = await def.handler({ a: 1 })
    expect(domainTool.handler).toHaveBeenCalledWith({ a: 1 })
    expect(res.content?.[0]).toEqual({ type: 'text', text: '{"a":1}' })
  })
})
