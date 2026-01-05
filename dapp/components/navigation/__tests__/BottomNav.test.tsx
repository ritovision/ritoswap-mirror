// components/navigation/__tests__/BottomNav.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'

// Mock all wallet components before importing BottomNav
vi.mock('@/components/wallet/connectButton/ConnectWrapper', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'connect' })
}))
vi.mock('@/components/wallet/network/NetworkWidget', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'network' })
}))
vi.mock('@/components/wallet/addressDisplay/AddressDisplay', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'address' })
}))
vi.mock('@/components/wallet/disconnectButton/DisconnectButton', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'disconnect' })
}))

import BottomNav from '../bottomNav/BottomNav'

describe('<BottomNav />', () => {
  it('renders all four wallet controls', () => {
    render(<BottomNav />)
    for (const id of ['connect','network','address','disconnect']) {
      expect(screen.getByTestId(id)).toBeInTheDocument()
    }
  })
})