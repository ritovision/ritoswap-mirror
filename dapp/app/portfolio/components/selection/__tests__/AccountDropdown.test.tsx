// \dapp\app\portfolio\components\selection\__tests__\AccountDropdown.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AccountDropdown from '../AccountDropdown'
import * as wagmi from 'wagmi'

// Stub useEnsName
vi.mock('wagmi', () => ({ useEnsName: vi.fn() }))
const useEnsNameMock = wagmi.useEnsName as ReturnType<typeof vi.fn>

describe('AccountDropdown', () => {
  afterEach(() => vi.clearAllMocks())

  it('falls back to shortened address when no ENS is found', async () => {
    const onConnect = vi.fn()
    const onAddressChange = vi.fn()
    const addr1 = '0x1111111111111111111111111111111111111111' as `0x${string}`
    const addr2 = '0x2222222222222222222222222222222222222222' as `0x${string}`

    // No ENS for either address
    useEnsNameMock.mockReturnValue({ data: undefined })

    render(
      <AccountDropdown
        isConnected={true}
        selectedAddress={addr1}
        addresses={[addr1, addr2]}
        onConnect={onConnect}
        onAddressChange={onAddressChange}
      />
    )

    const short1 = `${addr1.slice(0, 6)}...${addr1.slice(-4)}`
    const short2 = `${addr2.slice(0, 6)}...${addr2.slice(-4)}`

    // After mount, button shows shortened selectedAddress
    await waitFor(() => {
      expect(screen.getByText(short1)).toBeInTheDocument()
    })

    // Open the dropdown
    fireEvent.click(screen.getByRole('button'))

    // List options show both shortened addresses
    const items = await screen.findAllByRole('option')
    expect(items.map(item => item.textContent)).toEqual([short1, short2])
  })

  it('displays distinct ENS names for selected vs list items', async () => {
    const onConnect = vi.fn()
    const onAddressChange = vi.fn()
    const addr1 = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`
    const addr2 = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`

    // addr1 ⇒ foo.eth, addr2 ⇒ bar.eth
    useEnsNameMock.mockImplementation(({ address: queried }) => ({
      data: queried === addr1 ? 'foo.eth' : 'bar.eth',
    }))

    render(
      <AccountDropdown
        isConnected={true}
        selectedAddress={addr1}
        addresses={[addr1, addr2]}
        onConnect={onConnect}
        onAddressChange={onAddressChange}
      />
    )

    // Button shows foo.eth
    await waitFor(() => {
      expect(screen.getByText('foo.eth')).toBeInTheDocument()
    })

    // Open the dropdown
    fireEvent.click(screen.getByRole('button'))

    // List options show ['foo.eth', 'bar.eth']
    const items = await screen.findAllByRole('option')
    expect(items.map(item => item.textContent)).toEqual(['foo.eth', 'bar.eth'])
  })
})
