// dapp/components/chatBot/ChatMessages/components/__tests__/AssistantHeader.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import AssistantHeader from '../AssistantHeader'

// Keep logger quiet globally (if imported indirectly elsewhere)
vi.mock('@config/public.env', () => ({
  publicConfig: { logLevel: 'error' },
}))

describe('AssistantHeader', () => {
  it('renders assistant avatar and name', () => {
    render(<AssistantHeader />)

    const img = screen.getByAltText('RapBotRito') as HTMLImageElement
    expect(img).toBeInTheDocument()
    expect(img.src).toContain('/images/rito/rito-thinker.jpg')

    expect(screen.getByText('RapBotRito')).toBeInTheDocument()
  })
})
