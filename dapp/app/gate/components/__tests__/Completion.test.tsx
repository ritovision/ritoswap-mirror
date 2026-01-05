// app/gate/components/__tests__/Completion.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import Completion from '../Completion/Completion'

describe('Completion', () => {
  it('renders completion message', () => {
    render(<Completion />)
    
    expect(screen.getByText('Message Successfully Sent')).toBeInTheDocument()
    expect(screen.getByText('Your Key has been used and cannot be used again.')).toBeInTheDocument()
  })

  it('applies correct CSS classes', () => {
    render(<Completion />)
    
    const container = document.querySelector('[class*="container"]')
    const title = screen.getByText('Message Successfully Sent')
    const message = screen.getByText('Your Key has been used and cannot be used again.')
    
    expect(container).toBeInTheDocument()
    expect(title).toBeInTheDocument()
    expect(message).toBeInTheDocument()
    
    // Check that elements have the expected structure
    expect(title.tagName).toBe('H2')
    expect(message.tagName).toBe('P')
  })

  it('renders consistently on multiple renders', () => {
    const { rerender } = render(<Completion />)
    
    expect(screen.getByText('Message Successfully Sent')).toBeInTheDocument()
    expect(screen.getByText('Your Key has been used and cannot be used again.')).toBeInTheDocument()
    
    rerender(<Completion />)
    
    expect(screen.getByText('Message Successfully Sent')).toBeInTheDocument()
    expect(screen.getByText('Your Key has been used and cannot be used again.')).toBeInTheDocument()
  })
})