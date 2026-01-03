// app/portfolio/components/assets/__tests__/NativeBalance.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import NativeBalance from '../NativeBalance'
import * as wagmi from 'wagmi'

// Mock the wagmi hooks
vi.mock('wagmi', () => ({
  useBalance: vi.fn(),
  useConfig: vi.fn(),
}))

const useConfigMock = wagmi.useConfig as ReturnType<typeof vi.fn>
const useBalanceMock = wagmi.useBalance as ReturnType<typeof vi.fn>

describe('NativeBalance Component', () => {
  beforeEach(() => {
    useConfigMock.mockReturnValue({
      chains: [
        {
          id: 1,
          nativeCurrency: { symbol: 'ETH', name: 'Ether' },
          name: 'Ethereum',
        },
      ],
    })
  })

  it('renders spinner while loading', () => {
    useBalanceMock.mockReturnValue({
      data: undefined,
      isError: false,
      isLoading: true,
    })

    const { container } = render(
      <NativeBalance chainId={1} address="0xabc" />
    )

    // spinner div gets rendered even though no text appears
    const spinnerEl = container.querySelector('[class*="spinner"]')
    expect(spinnerEl).toBeInTheDocument()
  })

  it('hides on error', () => {
    useBalanceMock.mockReturnValue({
      data: undefined,
      isError: true,
      isLoading: false,
    })

    const { container } = render(
      <NativeBalance chainId={1} address="0xabc" />
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('renders formatted native balance when loaded', () => {
    useBalanceMock.mockReturnValue({
      data: { value: BigInt('1230000000000000000'), symbol: 'ETH' },
      isError: false,
      isLoading: false,
    })

    render(<NativeBalance chainId={1} address="0xabc" />)

    // should show "1.23" and the symbol twice (label + unit)
    expect(screen.getByText('1.23')).toBeInTheDocument()
    expect(screen.getAllByText('ETH').length).toBeGreaterThan(1)
  })
})
