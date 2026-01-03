// __tests__/SelectToken.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SelectToken, { TokenType } from '../SelectToken'

describe('SelectToken', () => {
  it('renders options and calls onSelectionChange on toggle', async () => {
    const onSelectionChange = vi.fn()
    render(<SelectToken onSelectionChange={onSelectionChange} />)

    // title
    expect(screen.getByText('Select Tokens')).toBeInTheDocument()

    // initial callback with []
    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenCalledWith([])
    })

    // click ERC-20
    fireEvent.click(screen.getByText('ERC-20'))
    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenCalledWith(['ERC-20'] as TokenType[])
    })

    // click ERC-20 again to unselect
    fireEvent.click(screen.getByText('ERC-20'))
    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenCalledWith([] as TokenType[])
    })
  })
})
