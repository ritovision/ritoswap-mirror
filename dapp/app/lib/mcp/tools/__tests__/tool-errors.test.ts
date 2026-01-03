import { fail, ToolFailure, errorResultShape } from '../tool-errors'

describe('tool-errors', () => {
  it('fail() throws ToolFailure with marker', () => {
    try {
      fail('Nope')
      expect.unreachable() // should not reach
    } catch (e: any) {
      expect(e).toBeInstanceOf(ToolFailure)
      expect(e.message).toBe('Nope')
      expect(e.isToolFailure).toBe(true)
      expect(e.name).toBe('ToolFailure')
    }
  })

  it('errorResultShape() returns expected wire shape', () => {
    const r = errorResultShape('Bang')
    expect(r).toEqual({
      content: [{ type: 'text', text: 'Bang' }],
      isError: true,
    })
  })
})
