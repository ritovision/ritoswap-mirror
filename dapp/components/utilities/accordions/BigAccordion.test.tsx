// components/utilities/accordions/BigAccordion.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BigAccordion } from './BigAccordion'

describe('<BigAccordion />', () => {
  const mockItems = [
    { title: 'Section 1', content: 'Content 1', value: 'section1' },
    { title: 'Section 2', content: 'Content 2', value: 'section2' },
    { title: 'Section 3', content: 'Content 3', value: 'section3' }
  ]

  it('renders all accordion items', () => {
    render(<BigAccordion items={mockItems} />)
    mockItems.forEach(item => {
      expect(screen.getByText(item.title)).toBeInTheDocument()
    })
  })

  it('expands/collapses on click', async () => {
    render(<BigAccordion items={mockItems} />)
    
    expect(screen.queryByText('Content 1')).not.toBeInTheDocument()
    
    fireEvent.click(screen.getByText('Section 1'))
    await waitFor(() => {
      expect(screen.getByText('Content 1')).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByText('Section 1'))
    await waitFor(() => {
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument()
    })
  })

  it('allows multiple items open', async () => {
    render(<BigAccordion items={mockItems} />)
    
    fireEvent.click(screen.getByText('Section 1'))
    fireEvent.click(screen.getByText('Section 2'))
    
    await waitFor(() => {
      expect(screen.getByText('Content 1')).toBeInTheDocument()
      expect(screen.getByText('Content 2')).toBeInTheDocument()
    })
  })

  it('opens item from URL hash', () => {
    window.location.hash = '#section2'
    render(<BigAccordion items={mockItems} />)
    
    expect(screen.getByText('Content 2')).toBeInTheDocument()
  })

  it('applies custom content padding', async () => {
    render(<BigAccordion items={mockItems} contentPadding={3} />)
    fireEvent.click(screen.getByText('Section 1'))
    
    await waitFor(() => {
      expect(screen.getByText('Content 1')).toBeInTheDocument()
    })
    
    // Find the content wrapper with overflow: hidden style
    const contentWrapper = document.querySelector('[style*="overflow: hidden"]') as HTMLElement
    expect(contentWrapper).toBeTruthy()
    expect(contentWrapper.style.paddingLeft).toBe('3rem')
    expect(contentWrapper.style.paddingRight).toBe('3rem')
  })

  it('hides underline when showUnderline is false', () => {
    const { container } = render(<BigAccordion items={mockItems} showUnderline={false} />)
    expect(container.querySelector('.underline')).not.toBeInTheDocument()
  })
})