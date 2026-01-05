// components/utilities/wallet/__tests__/NetworkWidget.test.tsx
import React from 'react'
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react'

// 0️⃣ Mock active/target chain id
vi.mock('@config/chain', () => ({
  getTargetChainId: () => 137,
}))

// 1️⃣ Mock NetworkModal so we don't pull in its real implementation
vi.mock('../network/NetworkModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="network-modal">Select a Network</div> : null,
}))

// 2️⃣ Mock wagmi hooks
const useAccountMock = vi.fn()
const useBalanceMock = vi.fn()
const useConfigMock = vi.fn()
vi.mock('wagmi', () => ({
  useAccount: () => useAccountMock(),
  useBalance: (args: any) => useBalanceMock(args),
  useConfig: () => useConfigMock(),
}))

// 2.5 Mock DappChainProvider
vi.mock('@/components/providers/DappChainProvider', () => ({
  useDappChain: () => ({
    dappChainId: 137,
    setDappChainId: vi.fn(),
    resetToActiveChain: vi.fn(),
    isOnActiveChain: true,
  }),
}))

// 3️⃣ Mock ChainInfoProvider (formerly LogoProvider)
const getChainLogoUrlMock = vi.fn()
const getFallbackLogoUrlMock = vi.fn()
vi.mock('@/components/providers/ChainInfoProvider', () => ({
  useChainInfo: () => ({
    getChainLogoUrl: getChainLogoUrlMock,
    getFallbackLogoUrl: getFallbackLogoUrlMock,
  }),
}))

import NetworkWidget from '../network/NetworkWidget'

describe('NetworkWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useConfigMock.mockReturnValue({
      chains: [
        {
          id: 137,
          name: 'Polygon',
          nativeCurrency: { symbol: 'MATIC' },
        },
      ],
    })
    getChainLogoUrlMock.mockReturnValue('current-logo.png')
    getFallbackLogoUrlMock.mockReturnValue('fallback-logo.png')
  })

  afterEach(cleanup)

  it('shows fallback UI when not connected', () => {
    useAccountMock.mockReturnValue({ isConnected: false, address: undefined })
    useBalanceMock.mockReturnValue({ data: null, isLoading: false })

    render(<NetworkWidget />)

    expect(screen.getByText('???')).toBeInTheDocument()
    expect(screen.getByText('unknown')).toBeInTheDocument()

    const img = screen.getByAltText('Unknown network') as HTMLImageElement
    expect(img.src).toContain('fallback-logo.png')
  })

  it('renders target-chain symbol and formatted balance when connected', () => {
    useAccountMock.mockReturnValue({ isConnected: true, address: '0x123' })
    useBalanceMock.mockReturnValue({
      data: { value: BigInt('1500000000000000000'), decimals: 18 },
      isLoading: false,
    })

    render(<NetworkWidget />)

    expect(useBalanceMock).toHaveBeenCalledWith(
      expect.objectContaining({ address: '0x123', chainId: 137 })
    )
    expect(screen.getByText('MATIC')).toBeInTheDocument()
    expect(screen.getByText('1.50000')).toBeInTheDocument()

    const img = screen.getByAltText('MATIC logo') as HTMLImageElement
    expect(img.src).toContain('current-logo.png')
  })

  it('shows loading state when balance is loading', () => {
    useAccountMock.mockReturnValue({ isConnected: true, address: '0x123' })
    useBalanceMock.mockReturnValue({ data: null, isLoading: true })

    render(<NetworkWidget />)
    expect(screen.getByText('...')).toBeInTheDocument()
  })

  it('falls back to fallback-logo.png when the chain-logo image errors', () => {
    useAccountMock.mockReturnValue({ isConnected: true, address: '0x123' })
    useBalanceMock.mockReturnValue({ data: null, isLoading: false })

    render(<NetworkWidget />)
    const img = screen.getByAltText('MATIC logo') as HTMLImageElement
    expect(img.src).toContain('current-logo.png')

    fireEvent.error(img)
    expect(img.src).toContain('fallback-logo.png')
  })

  it('opens NetworkModal when clicked', () => {
    useAccountMock.mockReturnValue({ isConnected: true, address: '0x123' })
    useBalanceMock.mockReturnValue({ data: null, isLoading: false })

    const { container } = render(<NetworkWidget />)
    fireEvent.click(container.firstChild as Element)
    expect(screen.getByTestId('network-modal')).toBeInTheDocument()
  })

  it('shows immediately when no-nav variant is used', () => {
    useAccountMock.mockReturnValue({ isConnected: true, address: '0xabc' })
    useBalanceMock.mockReturnValue({ data: null, isLoading: false })

    render(<NetworkWidget variant="no-nav" />)
    expect(screen.getByText('MATIC')).toBeInTheDocument()
  })

  describe('variant behavior with delayed mount/unmount', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      useAccountMock.mockReturnValue({ isConnected: true, address: '0xabc' })
      useBalanceMock.mockReturnValue({ data: null, isLoading: false })
    })

    afterEach(() => {
      vi.runOnlyPendingTimers()
      vi.useRealTimers()
    })

    it('mounts after 100ms when connected with topnav variant', () => {
      render(<NetworkWidget variant="topnav" />)
      expect(screen.queryByText('MATIC')).toBeNull()

      act(() => {
        vi.advanceTimersByTime(100)
      })

      expect(screen.getByText('MATIC')).toBeInTheDocument()
    })

    it('unmounts immediately when disconnected with bottomnav variant', () => {
      const { rerender } = render(<NetworkWidget variant="bottomnav" />)

      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(screen.getByText('MATIC')).toBeInTheDocument()

      useAccountMock.mockReturnValue({ isConnected: false, address: undefined })
      rerender(<NetworkWidget variant="bottomnav" />)

      expect(screen.queryByText('MATIC')).toBeNull()
    })
  })
})
