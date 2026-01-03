import { vi, describe, it, expect, beforeEach } from 'vitest'

// capture what we passed to react-swipeable
const passedConfig: { current: any } = { current: null }

// Mock react-swipeable. Keep return type loose to avoid TS typing issues.
vi.mock('react-swipeable', () => ({
  useSwipeable: (config: any) => {
    passedConfig.current = config
    // Return a generic object; we won't rely on its type.
    return {} as any
  },
}))

describe('useSwipeToClose', () => {
  beforeEach(() => {
    passedConfig.current = null
  })

  it('calls onClose on onSwipedLeft and passes expected config', async () => {
    const { useSwipeToClose } = await import('../useSwipeToClose')
    const onClose = vi.fn()

    // hook invocation (we only care about the config it passes to react-swipeable)
    const handlers = useSwipeToClose(onClose)
    expect(handlers).toBeTruthy()

    // simulate a swipe by calling the captured config's callback
    expect(typeof passedConfig.current.onSwipedLeft).toBe('function')
    passedConfig.current.onSwipedLeft()

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(passedConfig.current).toMatchObject({
      preventScrollOnSwipe: true,
      trackTouch: true,
      trackMouse: false,
      swipeDuration: 300,
      delta: { left: 50 },
    })
  })
})
