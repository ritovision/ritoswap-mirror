// components/utilities/wallet/__tests__/AccountModal.test.tsx
/// <reference types="vitest" />
import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock active/target chain id
vi.mock('@config/chain', () => ({
  getTargetChainId: () => 1,
}))

// 1) Stub next/image
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}))

// 2) Stub wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useDisconnect: vi.fn(),
  useEnsName: vi.fn(),
  useEnsAvatar: vi.fn(),
  useBalance: vi.fn(),
  useConfig: vi.fn(),
}))

// 3) Stub ChainInfoProvider
vi.mock('@/components/providers/ChainInfoProvider', () => ({
  useChainInfo: vi.fn(),
}))

// 3.5) Stub DappChainProvider
vi.mock('@/components/providers/DappChainProvider', () => ({
  useDappChain: () => ({
    dappChainId: 1,
    setDappChainId: vi.fn(),
    resetToActiveChain: vi.fn(),
    isOnActiveChain: true,
  }),
}))

// 4) Stub formatUnits
vi.mock('viem', () => ({
  formatUnits: vi.fn().mockReturnValue('1'),
}))

// 5) FIXED: stub NetworkModal as a proper ES module
vi.mock('../network/NetworkModal', () => {
  return {
    __esModule: true,
    default: (props: { isOpen: boolean; onClose: () => void }) => (
      <div
        data-testid="network-modal"
        data-open={props.isOpen ? 'true' : 'false'}
      />
    ),
  }
})

// Now import after all mocks
import AccountModal from '../accountModal/AccountModal'
import {
  useAccount,
  useDisconnect,
  useEnsName,
  useEnsAvatar,
  useBalance,
  useConfig,
} from 'wagmi'
import { useChainInfo } from '@/components/providers/ChainInfoProvider'

describe('AccountModal', () => {
  const address1 = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const address2 = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  const mockDisconnect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // cast to any so we can call .mockReturnValue/.mockImplementation
    ;(useAccount as any).mockReturnValue({
      address: address1,
      addresses: [address1, address2],
    })
    ;(useDisconnect as any).mockReturnValue({ disconnect: mockDisconnect })
    ;(useConfig as any).mockReturnValue({
      chains: [
        {
          id: 1,
          name: 'Ethereum',
          nativeCurrency: { symbol: 'ETH' },
        },
      ],
    })
    ;(useChainInfo as any).mockReturnValue({
      getChainLogoUrl: () => 'logo.png',
      getFallbackLogoUrl: () => 'fallback.png',
      getChainDisplayName: () => 'ChainName',
    })
    ;(useEnsName as any).mockReturnValue({ data: undefined })
    ;(useEnsAvatar as any).mockReturnValue({ data: undefined })
    ;(useBalance as any).mockImplementation(
      ({ address }: { address: string }) =>
        address === address1
          ? { data: { value: BigInt('1000000000000000000'), decimals: 18 }, isLoading: false }
          : { data: undefined, isLoading: true }
    )
  })

  it('renders nothing when isOpen is false', () => {
    const onClose = vi.fn()
    const { container } = render(<AccountModal isOpen={false} onClose={onClose} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders accounts, network modal toggle, and actions when open', () => {
    const onClose = vi.fn()
    const { getByText, getByTestId, getByRole, container } = render(
      <AccountModal isOpen={true} onClose={onClose} />
    )

    // Balances
    expect(getByText('1.00000')).toBeInTheDocument()
    expect(getByText('...')).toBeInTheDocument()

    // Addresses
    const t1 = `${address1.slice(0, 6)}…${address1.slice(-4)}`
    const t2 = `${address2.slice(0, 6)}…${address2.slice(-4)}`
    expect(getByText(t1)).toBeInTheDocument()
    expect(getByText(t2)).toBeInTheDocument()

    // Network button text
    expect(getByText('ChainName · ETH')).toBeInTheDocument()

    // NetworkModal starts closed
    const networkModal = getByTestId('network-modal')
    expect(networkModal).toHaveAttribute('data-open', 'false')

    // Close & Disconnect buttons
    expect(getByRole('button', { name: /Close modal/i })).toBeInTheDocument()
    expect(getByRole('button', { name: /Disconnect wallet/i })).toBeInTheDocument()

    // Clicking overlay calls onClose
    fireEvent.click(container.firstChild as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)

    // Clicking the close icon
    fireEvent.click(getByRole('button', { name: /Close modal/i }))
    expect(onClose).toHaveBeenCalledTimes(2)

    // Opening network modal
    fireEvent.click(getByText('ChainName · ETH').closest('button')!)
    expect(getByTestId('network-modal')).toHaveAttribute('data-open', 'true')

    // Disconnect
    fireEvent.click(getByRole('button', { name: /Disconnect wallet/i }))
    expect(mockDisconnect).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})
