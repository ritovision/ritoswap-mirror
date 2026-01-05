import { render, fireEvent, act } from '@testing-library/react'
import DisconnectButton from '../disconnectButton/DisconnectButton'

vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useDisconnect: vi.fn(),
}))

import { useAccount, useDisconnect } from 'wagmi'

describe('DisconnectButton', () => {
  const mockDisconnect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    ;(useDisconnect as any).mockReturnValue({
      disconnect: mockDisconnect,
    })
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('should not render when not connected', () => {
    ;(useAccount as any).mockReturnValue({ isConnected: false })

    const { container } = render(
      <DisconnectButton variant="topnav" />
    )
    // flush the initial 100ms timer
    act(() => {
      vi.runAllTimers()
    })

    expect(container.firstChild).toBeNull()
  })

  it('should render when connected', () => {
    ;(useAccount as any).mockReturnValue({ isConnected: true })

    const { getByLabelText } = render(
      <DisconnectButton variant="topnav" />
    )

    // Advance timers to trigger the 100ms show delay
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(
      getByLabelText('Disconnect wallet')
    ).toBeInTheDocument()
  })

  it('should call disconnect when clicked', () => {
    ;(useAccount as any).mockReturnValue({ isConnected: true })

    const { getByLabelText } = render(
      <DisconnectButton variant="bottomnav" />
    )

    act(() => {
      vi.advanceTimersByTime(100)
    })

    fireEvent.click(
      getByLabelText('Disconnect wallet')
    )
    expect(mockDisconnect).toHaveBeenCalled()
  })

  it('should hide when connection lost', () => {
    // 1) render initially unconnected
    ;(useAccount as any).mockReturnValue({ isConnected: false })
    const { rerender, container } = render(
      <DisconnectButton variant="topnav" />
    )
    act(() => {
      vi.runAllTimers()
    })
    expect(container.firstChild).toBeNull()

    // 2) simulate a connection
    ;(useAccount as any).mockReturnValue({ isConnected: true })
    rerender(<DisconnectButton variant="topnav" />)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(
      container.querySelector('button[aria-label="Disconnect wallet"]')
    ).toBeTruthy()

    // 3) simulate a disconnect
    ;(useAccount as any).mockReturnValue({ isConnected: false })
    rerender(<DisconnectButton variant="topnav" />)

    // flush our zero-ms unmount timeout
    act(() => {
      vi.runAllTimers()
    })

    expect(container.firstChild).toBeNull()
  })

  it('should use no-nav as default variant', () => {
    ;(useAccount as any).mockReturnValue({ isConnected: true })

    const { getByLabelText } = render(<DisconnectButton />)

    act(() => {
      vi.advanceTimersByTime(100)
    })

    const button = getByLabelText('Disconnect wallet')
    expect(button.className).toContain('no-nav')
  })
})