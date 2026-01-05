// \dapp\app\portfolio\components\organize\__tests__\Placeholder.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import Placeholder from '../Placeholder'

describe('Placeholder', () => {
  it('renders the correct prompt text', () => {
    render(<Placeholder />)

    const promptText =
      'Connect Your Wallet, Select a Blockchain and a Token Type to Display Assets Here'

    // You can either query the <h2> directly...
    expect(
      screen.getByText(promptText)
    ).toBeInTheDocument()

    // ...or assert via the live-region role:
    expect(
      screen.getByRole('status')
    ).toHaveTextContent(promptText)
  })
})
