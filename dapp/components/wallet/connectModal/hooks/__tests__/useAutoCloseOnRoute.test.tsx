import React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * We keep the component mounted and change the mocked pathname between rerenders.
 * This allows the hook's ref(prevPathname) to detect a change.
 */
describe('useAutoCloseOnRoute', () => {
  let pathname: string

  beforeEach(() => {
    vi.resetModules()
    pathname = '/home'

    vi.doMock('next/navigation', () => ({
      useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
      useSearchParams: () => ({ get: vi.fn() }),
      usePathname: () => pathname,
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  function makeHarness(isOpen: boolean, onClose: () => void) {
    return import('../useAutoCloseOnRoute').then(({ useAutoCloseOnRoute }) => {
      function Harness({ open }: { open: boolean }) {
        useAutoCloseOnRoute(open, onClose)
        return null
      }
      return { Harness }
    })
  }

  it('does not call onClose when route changes but modal is closed', async () => {
    const onClose = vi.fn()
    const { Harness } = await makeHarness(false, onClose)
    const { rerender } = render(<Harness open={false} />)

    pathname = '/dashboard'
    rerender(<Harness open={false} />)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when route changes while modal is open', async () => {
    const onClose = vi.fn()
    const { Harness } = await makeHarness(true, onClose)
    const { rerender } = render(<Harness open={true} />)

    pathname = '/settings'
    rerender(<Harness open={true} />)

    // effect runs after commit; no timers involved
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose if pathname is unchanged', async () => {
    const onClose = vi.fn()
    const { Harness } = await makeHarness(true, onClose)
    const { rerender } = render(<Harness open={true} />)
    rerender(<Harness open={true} />)
    expect(onClose).not.toHaveBeenCalled()
  })
})
