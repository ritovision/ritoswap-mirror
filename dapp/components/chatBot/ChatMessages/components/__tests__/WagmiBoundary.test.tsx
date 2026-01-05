// dapp/components/chatBot/ChatMessages/components/__tests__/WagmiBoundary.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import WagmiBoundary from '../WagmiBoundary'

// Silence React's error logs when an error boundary catches
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

// Force logger to be quiet
vi.mock('@config/public.env', () => ({
  publicConfig: { logLevel: 'error' },
}))

class Bomb extends React.Component {
  render(): React.ReactNode {
    throw new Error('boom')
  }
}

describe('WagmiBoundary', () => {
  afterAll(() => {
    consoleErrorSpy.mockRestore()
  })

  it('renders children when there is no error', () => {
    render(
      <WagmiBoundary fallback={<div>Fallback</div>}>
        <div>Child content</div>
      </WagmiBoundary>
    )
    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  it('renders fallback when a child throws', () => {
    render(
      <WagmiBoundary fallback={<div>Fallback UI</div>}>
        <Bomb />
      </WagmiBoundary>
    )
    expect(screen.getByText('Fallback UI')).toBeInTheDocument()
    expect(screen.queryByText('Child content')).not.toBeInTheDocument()
  })
})
