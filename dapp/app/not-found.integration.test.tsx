// app/not-found.integration.test.tsx
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import * as nextNav from 'next/navigation'
import NotFound from './not-found'
import '@testing-library/jest-dom'

describe('<NotFound />', () => {
  let pushMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // fake out the Next router
    pushMock = vi.fn()
    vi.spyOn(nextNav, 'useRouter').mockReturnValue({ push: pushMock } as any)

    // switch to fake timers so we can advance the 5 sec
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders the 404 message and link', () => {
    render(<NotFound />)

    expect(
      screen.getByRole('heading', { level: 1 })
    ).toHaveTextContent('404 — Page Not Found')

    expect(
      screen.getByText(/redirected to the homepage shortly/i)
    ).toBeInTheDocument()

    const clickHere = screen.getByRole('link', { name: /click here/i })
    expect(clickHere).toHaveAttribute('href', '/')
  })

  it('redirects to “/” after 5 seconds via router.push', () => {
    render(<NotFound />)

    // No push immediately
    expect(pushMock).not.toHaveBeenCalled()

    // Fast-forward time by 5 sec
    vi.advanceTimersByTime(5000)

    expect(pushMock).toHaveBeenCalledTimes(1)
    expect(pushMock).toHaveBeenCalledWith('/')
  })

  it('clears the timeout when unmounted', () => {
    const { unmount } = render(<NotFound />)

    // unmount before 5 sec
    unmount()
    vi.advanceTimersByTime(5000)

    // should never call push after unmount
    expect(pushMock).not.toHaveBeenCalled()
  })
})
