// app\portfolio\components\selection\__tests__\SelectAccount.test.tsx
import React from 'react'
import { render, waitFor, act } from '@testing-library/react'
import SelectAccount from '../SelectAccount'
import * as wagmi from 'wagmi'

// Stub useAccount from wagmi
vi.mock('wagmi', () => ({ useAccount: vi.fn() }))
const useAccountMock = wagmi.useAccount as ReturnType<typeof vi.fn>

// Stub AccountDropdown to capture its props
let lastDropdownProps: any
vi.mock('../AccountDropdown', () => ({
  __esModule: true,
  default: (props: any) => {
    lastDropdownProps = props
    return <div data-testid="account-dropdown" />
  },
}))

// Stub ConnectModal to capture its props
let lastModalProps: any
vi.mock('@components/wallet/connectModal/ConnectModal', () => ({
  __esModule: true,
  default: (props: any) => {
    lastModalProps = props
    return <div data-testid="connect-modal" />
  },
}))

describe('SelectAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lastDropdownProps = undefined
    lastModalProps = undefined
  })

  it('initializes disconnected and opens modal on connect click', async () => {
    const onAccountChange = vi.fn()
    useAccountMock.mockReturnValue({
      address: undefined,
      addresses: [],
      isConnected: false,
    })

    render(<SelectAccount onAccountChange={onAccountChange} />)

    // should notify parent of empty address on mount
    await waitFor(() => {
      expect(onAccountChange).toHaveBeenCalledWith('')
    })

    // AccountDropdown should receive correct props
    expect(lastDropdownProps).toMatchObject({
      isConnected: false,
      selectedAddress: '',
      addresses: [],
    })
    expect(typeof lastDropdownProps.onConnect).toBe('function')

    // ConnectModal should start closed
    expect(lastModalProps).toMatchObject({ isOpen: false })

    // simulate clicking "Connect" in the dropdown
    act(() => {
      lastDropdownProps.onConnect()
    })
    await waitFor(() => {
      expect(lastModalProps).toMatchObject({ isOpen: true })
    })

    // simulate closing the modal
    act(() => {
      lastModalProps.onClose()
    })
    await waitFor(() => {
      expect(lastModalProps).toMatchObject({ isOpen: false })
    })
  })

  it('initializes connected and opens modal on connect click', async () => {
    const onAccountChange = vi.fn()
    const addr = '0x1111111111111111111111111111111111111111' as `0x${string}`
    const allAddrs = [
      addr,
      '0x2222222222222222222222222222222222222222' as `0x${string}`,
    ]
    useAccountMock.mockReturnValue({
      address: addr,
      addresses: allAddrs,
      isConnected: true,
    })

    render(<SelectAccount onAccountChange={onAccountChange} />)

    // should notify parent of the connected address on mount
    await waitFor(() => {
      expect(onAccountChange).toHaveBeenCalledWith(addr)
    })

    // AccountDropdown should receive the connected addresses
    expect(lastDropdownProps).toMatchObject({
      isConnected: true,
      selectedAddress: addr,
      addresses: allAddrs,
    })
    expect(typeof lastDropdownProps.onConnect).toBe('function')

    // ConnectModal should start closed
    expect(lastModalProps).toMatchObject({ isOpen: false })

    // simulate clicking "Connect" again (to open modal)
    act(() => {
      lastDropdownProps.onConnect()
    })
    await waitFor(() => {
      expect(lastModalProps).toMatchObject({ isOpen: true })
    })
  })
})
