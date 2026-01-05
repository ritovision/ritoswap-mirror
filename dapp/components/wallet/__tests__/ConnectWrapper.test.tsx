import { render, act } from '@testing-library/react'
import ConnectWrapper from '../connectButton/ConnectWrapper'

vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useConnect: vi.fn(),
}))

vi.mock('../connectButton/ConnectState', () => ({
  default: () => <div>Connect State Component</div>,
}))

import { useAccount, useConnect } from 'wagmi'

describe('ConnectWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('should show button when not connected', () => {
    ;(useAccount as any).mockReturnValue({ isConnected: false })
    ;(useConnect as any).mockReturnValue({ isPending: false })
    
    const { getByText } = render(<ConnectWrapper />)
    
    act(() => {
      vi.advanceTimersByTime(100)
    })
    
    expect(getByText('Connect State Component')).toBeInTheDocument()
  })

  it('should hide button when connected', () => {
    ;(useAccount as any).mockReturnValue({ isConnected: true })
    ;(useConnect as any).mockReturnValue({ isPending: false })
    
    const { container } = render(<ConnectWrapper variant="topnav" />)
    vi.runAllTimers()
    
    expect(container.firstChild).toBeNull()
  })

  it('should not show while connecting', () => {
    ;(useAccount as any).mockReturnValue({ isConnected: false })
    ;(useConnect as any).mockReturnValue({ isPending: true })
    
    const { container } = render(<ConnectWrapper variant="bottomnav" />)
    vi.runAllTimers()
    
    expect(container.firstChild).toBeNull()
  })

  it('should apply correct variant class', () => {
    ;(useAccount as any).mockReturnValue({ isConnected: false })
    ;(useConnect as any).mockReturnValue({ isPending: false })
    
    const { container } = render(<ConnectWrapper variant="topnav" />)
    
    act(() => {
      vi.advanceTimersByTime(100)
    })
    
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('topnav')
  })

  it('should use no-nav as default variant', () => {
    ;(useAccount as any).mockReturnValue({ isConnected: false })
    ;(useConnect as any).mockReturnValue({ isPending: false })
    
    const { container } = render(<ConnectWrapper />)
    
    act(() => {
      vi.advanceTimersByTime(100)
    })
    
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('no-nav')
  })
})