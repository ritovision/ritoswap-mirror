// components/utilities/dropdown/Dropdown.test.tsx
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import Dropdown from './Dropdown'

describe('<Dropdown />', () => {
  const items = ['Option 1', 'Option 2', 'Option 3']

  it('displays label by default', () => {
    render(<Dropdown items={items} label="Choose option" />)
    expect(screen.getByText('Choose option')).toBeInTheDocument()
  })

  it('shows selected value', () => {
    render(<Dropdown items={items} selectedValue="Option 2" />)
    expect(screen.getByText('Option 2')).toBeInTheDocument()
  })

  it('opens dropdown on click', () => {
    render(<Dropdown items={items} />)

    // The trigger is a combobox, not a button
    const trigger = screen.getByRole('combobox', { name: 'Select an option' })
    fireEvent.click(trigger)

    // All options should now be in the document
    items.forEach(item => {
      expect(screen.getByText(item)).toBeInTheDocument()
    })
  })

  it('selects item and closes dropdown', () => {
    const onChange = vi.fn()
    render(<Dropdown items={items} onChange={onChange} />)

    const trigger = screen.getByRole('combobox', { name: 'Select an option' })
    fireEvent.click(trigger)

    fireEvent.click(screen.getByText('Option 2'))

    expect(onChange).toHaveBeenCalledWith('Option 2')
    // After selection, the list should close
    expect(screen.queryByText('Option 1')).not.toBeInTheDocument()
  })

  it('does not open when disabled', () => {
    render(<Dropdown items={items} state="disabled" />)

    const trigger = screen.getByRole('combobox', { name: 'Select an option' })
    fireEvent.click(trigger)
    expect(screen.queryByText('Option 1')).not.toBeInTheDocument()
  })

  it('closes on outside click', () => {
    render(<Dropdown items={items} />)

    const trigger = screen.getByRole('combobox', { name: 'Select an option' })
    fireEvent.click(trigger)
    expect(screen.getByText('Option 1')).toBeInTheDocument()

    // Click outside
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Option 1')).not.toBeInTheDocument()
  })
})
