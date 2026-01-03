import { describe, it, afterEach, expect } from 'vitest'
import React from 'react'
import { render, cleanup, act, screen } from '@testing-library/react'
import { usePromptModals } from '../usePromptModals'

afterEach(() => {
  cleanup()
})

function Harness() {
  const m = usePromptModals()
  // expose values + actions via DOM
  return (
    <div>
      <div data-testid="sel">{String(m.isSelectionOpen)}</div>
      <div data-testid="edt">{String(m.isEditorOpen)}</div>
      <div data-testid="editing">{m.editingPrompt ? 'yes' : 'no'}</div>

      <button data-testid="openSel" onClick={m.openSelection} />
      <button data-testid="closeSel" onClick={m.closeSelection} />
      <button data-testid="create" onClick={m.startCreateNew} />
      <button data-testid="back" onClick={m.backToSelection} />
      <button data-testid="closeEd" onClick={m.closeEditor} />
      <button
        data-testid="openEd"
        onClick={() => m.openEditor({ id: 'p1' } as any)}
      />
    </div>
  )
}

const txt = (id: string) => screen.getByTestId(id).textContent

describe('usePromptModals', () => {
  it('manages selection/editor state transitions', async () => {
    render(<Harness />)

    expect(txt('sel')).toBe('false')
    expect(txt('edt')).toBe('false')
    expect(txt('editing')).toBe('no')

    await act(async () => { screen.getByTestId('openSel').click() })
    expect(txt('sel')).toBe('true')

    await act(async () => { screen.getByTestId('create').click() })
    expect(txt('sel')).toBe('false')
    expect(txt('edt')).toBe('true')
    expect(txt('editing')).toBe('no')

    await act(async () => { screen.getByTestId('openEd').click() })
    expect(txt('sel')).toBe('false')
    expect(txt('edt')).toBe('true')
    expect(txt('editing')).toBe('yes')

    await act(async () => { screen.getByTestId('back').click() })
    expect(txt('sel')).toBe('true')
    expect(txt('edt')).toBe('false')

    await act(async () => { screen.getByTestId('closeSel').click() })
    expect(txt('sel')).toBe('false')

    await act(async () => {
      screen.getByTestId('openEd').click()
      screen.getByTestId('closeEd').click()
    })
    expect(txt('edt')).toBe('false')
    expect(txt('editing')).toBe('no')
  })
})
