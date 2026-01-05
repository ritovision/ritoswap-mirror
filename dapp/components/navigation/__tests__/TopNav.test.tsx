// File: components/navigation/__tests__/TopNav.test.tsx
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

// Mock next/image to strip Next.js–only props (like `priority`)
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...props }: any) => {
    // remove `priority` so it doesn’t end up on the DOM <img>
    const { priority, ...imgProps } = props
    return React.createElement('img', { src, alt, ...imgProps })
  },
}))

// Mock the MenuLinks component
vi.mock('@/components/navigation/menuLinks/MenuLinks', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'menu-links' }),
}))

// Mock all wallet‐related components
vi.mock(
  '@/components/wallet/connectButton/ConnectWrapper',
  () => ({
    __esModule: true,
    default: () => React.createElement('div', { 'data-testid': 'connect' }),
  })
)
vi.mock(
  '@/components/wallet/network/NetworkWidget',
  () => ({
    __esModule: true,
    default: () => React.createElement('div', { 'data-testid': 'network' }),
  })
)
vi.mock(
  '@/components/wallet/addressDisplay/AddressDisplay',
  () => ({
    __esModule: true,
    default: () => React.createElement('div', { 'data-testid': 'address' }),
  })
)
vi.mock(
  '@/components/wallet/disconnectButton/DisconnectButton',
  () => ({
    __esModule: true,
    default: () =>
      React.createElement('div', { 'data-testid': 'disconnect' }),
  })
)

import TopNav from '../topNav/TopNav'

describe('<TopNav />', () => {
  it('renders logo, all wallet widgets, and fades in menu links', async () => {
    render(<TopNav />)

    // Logo (alt text "RitoSwap Logo" => accessible name)
    const logo = await screen.findByRole('img', { name: 'RitoSwap Logo' })
    expect(logo).toHaveAttribute('src', '/images/brand/ritoswap.png')

    // Stubbed components
    for (const id of [
      'menu-links',
      'connect',
      'network',
      'address',
      'disconnect',
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument()
    }

    // Check that menu-links container gets the fadeIn class
    const linksContainer = screen.getByTestId('menu-links').parentElement!
    await waitFor(() => {
      expect(linksContainer.className).toMatch(/fadeIn/)
    })
  })
})
