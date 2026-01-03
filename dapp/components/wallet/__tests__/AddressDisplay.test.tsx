/// <reference types="vitest" />
import React from 'react'
import { render, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'

import AddressDisplay from '../addressDisplay/AddressDisplay'

// 1) Stub wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useEnsName: vi.fn(),
  useEnsAvatar: vi.fn(),
  useChainId: vi.fn(),
}))

// 2) Stub AccountModal so we don't pull in its wagmi deps
vi.mock('../accountModal/AccountModal', () => ({
  __esModule: true,
  default: (props: { isOpen: boolean; onClose: () => void }) => (
    <div data-testid="account-modal" data-open={props.isOpen ? 'true' : 'false'} />
  ),
}))

// 3) Import the mocked hooks
import { useAccount, useEnsName, useEnsAvatar, useChainId } from 'wagmi'

describe('AddressDisplay', () => {
  const testAddress = '0x1234567890123456789012345678901234567890'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    ;(useChainId as any).mockReturnValue(1)
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('does not render when disconnected', () => {
    ;(useAccount as any).mockReturnValue({ isConnected: false, address: undefined })
    ;(useEnsName as any).mockReturnValue({ data: null })
    ;(useEnsAvatar as any).mockReturnValue({ data: null })

    const { container } = render(<AddressDisplay variant="topnav" />)
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(container.firstChild).toBeNull()
  })

  it('shows truncated address when connected', () => {
    ;(useAccount as any).mockReturnValue({ isConnected: true, address: testAddress })
    ;(useEnsName as any).mockReturnValue({ data: null })
    ;(useEnsAvatar as any).mockReturnValue({ data: null })

    const { getByText } = render(<AddressDisplay variant="bottomnav" />)
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(getByText('0x1234…7890')).toBeInTheDocument()
  })

  it('transitions to ENS name when available', () => {
    ;(useAccount as any).mockReturnValue({ isConnected: true, address: testAddress })
    ;(useEnsName as any).mockReturnValue({ data: 'vitalik.eth' })
    ;(useEnsAvatar as any).mockReturnValue({ data: 'avatar-url.jpg' })

    const { getByText } = render(<AddressDisplay variant="topnav" />)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(getByText('0x1234…7890')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2500)
    })
    expect(getByText('vitalik.eth')).toBeInTheDocument()
  })

  it('truncates long ENS names', () => {
    ;(useAccount as any).mockReturnValue({ isConnected: true, address: testAddress })
    ;(useEnsName as any).mockReturnValue({
      data: 'verylongensnamethatshouldbetruncated.eth',
    })
    ;(useEnsAvatar as any).mockReturnValue({ data: null })

    const { getByText } = render(<AddressDisplay variant="topnav" />)
    act(() => {
      vi.advanceTimersByTime(100)
      vi.advanceTimersByTime(2500)
    })

    expect(getByText('verylongens…eth')).toBeInTheDocument()
  })

  it('opens the modal on click', () => {
    ;(useAccount as any).mockReturnValue({ isConnected: true, address: testAddress })
    ;(useEnsName as any).mockReturnValue({ data: null })
    ;(useEnsAvatar as any).mockReturnValue({ data: null })

    const { getByRole, getByTestId } = render(<AddressDisplay variant="topnav" />)
    act(() => {
      vi.advanceTimersByTime(100)
    })

    const modal = getByTestId('account-modal')
    expect(modal).toHaveAttribute('data-open', 'false')

    fireEvent.click(getByRole('button'))
    expect(modal).toHaveAttribute('data-open', 'true')
  })

  it('uses no-nav as default variant', () => {
    ;(useAccount as any).mockReturnValue({ isConnected: true, address: testAddress })
    ;(useEnsName as any).mockReturnValue({ data: null })
    ;(useEnsAvatar as any).mockReturnValue({ data: null })

    const { getByRole } = render(<AddressDisplay />)
    act(() => {
      vi.advanceTimersByTime(100)
    })

    const button = getByRole('button')
    expect(button.className).toContain('no-nav')
  })

  it('mounts immediately for the no-nav variant', () => {
    ;(useAccount as any).mockReturnValue({ isConnected: true, address: testAddress })
    ;(useEnsName as any).mockReturnValue({ data: null })
    ;(useEnsAvatar as any).mockReturnValue({ data: null })

    const { getByText } = render(<AddressDisplay variant="no-nav" />)
    expect(getByText('0x1234…7890')).toBeInTheDocument()
  })

  it('truncates long non-eth ENS names by preserving suffix characters', () => {
    ;(useAccount as any).mockReturnValue({ isConnected: true, address: testAddress })
    ;(useEnsName as any).mockReturnValue({
      data: 'averylongnamewithalt.tld',
    })
    ;(useEnsAvatar as any).mockReturnValue({ data: null })

    const { getByText } = render(<AddressDisplay variant="topnav" />)
    act(() => {
      vi.advanceTimersByTime(100)
      vi.advanceTimersByTime(2500)
    })

    expect(getByText('averylongna….tld')).toBeInTheDocument()
  })
})
