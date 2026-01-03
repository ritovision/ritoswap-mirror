// dapp/components/chatBot/ChatMessages/components/__tests__/UserHeaderFallback.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import UserHeaderFallback from '../UserHeader/UserHeaderFallback'

vi.mock('@config/public.env', () => ({
  publicConfig: { logLevel: 'error' },
}))

describe('UserHeaderFallback', () => {
  it('renders placeholder avatar and "You"', () => {
    render(<UserHeaderFallback />)
    expect(screen.getByText('U')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
    // No img should be present
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
