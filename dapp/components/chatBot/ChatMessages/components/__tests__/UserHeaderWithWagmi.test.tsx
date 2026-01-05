// dapp/components/chatBot/ChatMessages/components/__tests__/UserHeaderWithWagmi.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'

// Mock logger config to keep logs silent
vi.mock('@config/public.env', () => ({
  publicConfig: { logLevel: 'error' },
}))

// Mock wagmi hooks
const useAccountMock = vi.fn()
const useEnsNameMock = vi.fn()
const useEnsAvatarMock = vi.fn()

vi.mock('wagmi', () => ({
  useAccount: () => useAccountMock(),
  useEnsName: (args: any) => useEnsNameMock(args),
  useEnsAvatar: (args: any) => useEnsAvatarMock(args),
}))

import UserHeaderWithWagmi from '../UserHeader/UserHeaderWithWagmi'

describe('UserHeaderWithWagmi', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows placeholder and "You" when disconnected', () => {
    useAccountMock.mockReturnValue({
      address: undefined,
      isConnected: false,
      status: 'disconnected',
    })
    useEnsNameMock.mockReturnValue({ data: undefined, error: undefined })
    useEnsAvatarMock.mockReturnValue({ data: undefined, error: undefined })

    render(<UserHeaderWithWagmi />)

    expect(screen.getByText('U')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows placeholder and "You" when connected but no ENS', () => {
    useAccountMock.mockReturnValue({
      address: '0xabc123',
      isConnected: true,
      status: 'connected',
    })
    // ENS query disabled when no address or ENS; still return undefined
    useEnsNameMock.mockReturnValue({ data: undefined, error: undefined })
    useEnsAvatarMock.mockReturnValue({ data: undefined, error: undefined })

    render(<UserHeaderWithWagmi />)

    expect(screen.getByText('U')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows ENS avatar and "{ENS} (You)" when connected with ENS + avatar', () => {
    useAccountMock.mockReturnValue({
      address: '0xabc123',
      isConnected: true,
      status: 'connected',
    })
    useEnsNameMock.mockReturnValue({ data: 'matt.eth', error: undefined })
    useEnsAvatarMock.mockReturnValue({
      data: 'https://example.com/avatar.png',
      error: undefined,
    })

    render(<UserHeaderWithWagmi />)

    const name = 'matt.eth (You)'
    expect(screen.getByText(name)).toBeInTheDocument()

    const img = screen.getByRole('img') as HTMLImageElement
    expect(img).toBeInTheDocument()
    expect(img.alt).toBe(name)
    expect(img.src).toContain('https://example.com/avatar.png')
  })
})
