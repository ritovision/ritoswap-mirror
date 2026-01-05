// dapp/app/hooks/__tests__/useHydrateToolImages.test.tsx
import { renderHook, act } from '@testing-library/react' // <-- act from RTL

// --- Hoisted test doubles (avoid init order issues) ---
const { putFromBase64Mock } = vi.hoisted(() => ({
  putFromBase64Mock: vi.fn(),
}))

// --- Mocks must be declared before importing the hook ---

vi.mock('@store/toolImageStore', () => {
  const state = { putFromBase64: putFromBase64Mock }
  const useLocalImageStore = (selector?: (s: typeof state) => any) =>
    selector ? selector(state) : state
  return { useLocalImageStore }
})

vi.mock('@store/toolActivity', () => {
  const { create } = require('zustand') as typeof import('zustand')
  const store = create<{
    groups: Record<string, any>
    setGroups: (g: Record<string, any>) => void
  }>((set) => ({
    groups: {},
    setGroups: (g) => set({ groups: g }),
  }))
  return { useToolActivityStore: store }
})

// Now import the SUT and the mocked store
import useHydrateToolImages from '../useHydrateToolImages'
import { useToolActivityStore } from '@store/toolActivity'

describe('useHydrateToolImages', () => {
  beforeEach(() => {
    putFromBase64Mock.mockClear()
    useToolActivityStore.setState({ groups: {} })
  })

  it('does nothing when groups are empty or missing content', () => {
    renderHook(() => useHydrateToolImages())
    expect(putFromBase64Mock).not.toHaveBeenCalled()

    act(() => {
      useToolActivityStore.setState({ groups: { g1: {} } as any })
    })
    expect(putFromBase64Mock).not.toHaveBeenCalled()
  })

  it('hydrates a single store-image JSON payload exactly once', () => {
    renderHook(() => useHydrateToolImages())

    const groups = {
      g1: {
        chips: {
          c1: {
            output: {
              content: [
                { type: 'text', text: 'ignore me' },
                {
                  type: 'json',
                  data: {
                    kind: 'store-image',
                    name: 'cat.png',
                    mime: 'image/png',
                    width: 640,
                    height: 480,
                    alt: 'A cat!',
                    dataBase64: 'AAAABBBBCCCC',
                  },
                },
              ],
            },
          },
        },
      },
    }

    act(() => {
      useToolActivityStore.setState({ groups: groups as any })
    })

    expect(putFromBase64Mock).toHaveBeenCalledTimes(1)
    expect(putFromBase64Mock).toHaveBeenCalledWith({
      name: 'cat.png',
      mime: 'image/png',
      width: 640,
      height: 480,
      alt: 'A cat!',
      dataBase64: 'AAAABBBBCCCC',
    })

    // same state again -> ignored due to 'seen'
    act(() => {
      useToolActivityStore.setState({ groups: groups as any })
    })
    expect(putFromBase64Mock).toHaveBeenCalledTimes(1)
  })

  it('hydrates multiple images across chips and groups', () => {
    renderHook(() => useHydrateToolImages())

    const groups1 = {
      g1: {
        chips: {
          a: {
            output: {
              content: [
                { type: 'json', data: { kind: 'store-image', name: 'img1.jpg', mime: 'image/jpeg', width: 100, height: 200, alt: 'one', dataBase64: 'BASE1' } },
              ],
            },
          },
        },
      },
      g2: {
        chips: {
          b: {
            output: {
              content: [
                { type: 'json', data: { kind: 'store-image', name: 'img2.png', mime: 'image/png', width: 300, height: 400, alt: 'two', dataBase64: 'BASE2' } },
              ],
            },
          },
        },
      },
    }

    act(() => {
      useToolActivityStore.setState({ groups: groups1 as any })
    })

    expect(putFromBase64Mock).toHaveBeenCalledTimes(2)
    expect(putFromBase64Mock).toHaveBeenNthCalledWith(1, {
      name: 'img1.jpg', mime: 'image/jpeg', width: 100, height: 200, alt: 'one', dataBase64: 'BASE1',
    })
    expect(putFromBase64Mock).toHaveBeenNthCalledWith(2, {
      name: 'img2.png', mime: 'image/png', width: 300, height: 400, alt: 'two', dataBase64: 'BASE2',
    })
  })

  it('ignores non-json or json without kind=store-image', () => {
    renderHook(() => useHydrateToolImages())

    const noisy = {
      g1: {
        chips: {
          x: {
            output: {
              content: [
                { type: 'text', text: 'nope' },
                { type: 'json', data: { foo: 'bar' } },
                { type: 'json', data: { kind: 'not-store-image', name: 'nope' } },
                null,
                undefined,
              ],
            },
          },
        },
      },
    }

    act(() => {
      useToolActivityStore.setState({ groups: noisy as any })
    })

    expect(putFromBase64Mock).not.toHaveBeenCalled()
  })

  it('applies defaults when fields are missing', () => {
    renderHook(() => useHydrateToolImages())

    const minimal = {
      g1: {
        chips: {
          c1: {
            output: {
              content: [
                { type: 'json', data: { kind: 'store-image', name: 'x' } }, // only name provided
              ],
            },
          },
        },
      },
    }

    act(() => {
      useToolActivityStore.setState({ groups: minimal as any })
    })

    expect(putFromBase64Mock).toHaveBeenCalledTimes(1)
    expect(putFromBase64Mock).toHaveBeenCalledWith({
      name: 'x',
      mime: 'image/png',
      width: 0,
      height: 0,
      alt: 'Generated image',
      dataBase64: '',
    })
  })
})
