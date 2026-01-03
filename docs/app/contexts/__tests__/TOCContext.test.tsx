import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { TOCProvider, useTOC, type TOCItem } from '@/app/contexts/TOCContext'

function TOCConsumer() {
  const { toc, setTOC } = useTOC()

  return (
    <div>
      <button
        type="button"
        onClick={() => setTOC([{ id: 'updated', value: 'Updated', depth: 1 }])}
      >
        update
      </button>
      <span data-testid="toc-value">{toc[0]?.value ?? 'empty'}</span>
    </div>
  )
}

describe('TOCContext', () => {
  it('provides toc data and updater to consumers', async () => {
    const initialTOC: TOCItem[] = [{ id: 'intro', value: 'Introduction', depth: 1 }]

    render(
      <TOCProvider initialTOC={initialTOC}>
        <TOCConsumer />
      </TOCProvider>
    )

    expect(screen.getByTestId('toc-value')).toHaveTextContent('Introduction')
    await userEvent.click(screen.getByRole('button', { name: /update/i }))
    await waitFor(() =>
      expect(screen.getByTestId('toc-value')).toHaveTextContent('Updated')
    )
  })

  it('throws when used outside of provider', () => {
    const Consumer = () => {
      useTOC()
      return null
    }

    expect(() => render(<Consumer />)).toThrow('useTOC must be used within a TOCProvider')
  })
})
