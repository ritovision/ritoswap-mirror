import { describe, it, afterEach, expect, vi } from 'vitest'
import React, { useMemo, useRef, useEffect } from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { useDrawerDismiss } from '../useDrawerDismiss'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function Harness({
  isDrawerOpen,
  modalState
}: {
  isDrawerOpen: boolean
  modalState: {
    isSelectionOpen: boolean
    isEditorOpen: boolean
    closeSelection: () => void
    closeEditor: () => void
  }
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const closeDrawer = useMemo(() => vi.fn(), [])

  useEffect(() => {
    ;(window as any).__closeDrawer = closeDrawer
    ;(window as any).__modal = modalState
  }, [closeDrawer, modalState])

  useDrawerDismiss({
    isDrawerOpen,
    barRef: barRef as unknown as React.RefObject<HTMLDivElement>, // satisfy hook's type
    closeDrawer,
    modals: {
      isSelectionOpen: modalState.isSelectionOpen,
      closeSelection: modalState.closeSelection,
      isEditorOpen: modalState.isEditorOpen,
      closeEditor: modalState.closeEditor
    }
  })

  return (
    <div>
      <div data-testid="bar" ref={barRef}>bar</div>
      <div data-testid="outside">outside</div>
    </div>
  )
}

describe('useDrawerDismiss', () => {
  it('closes drawer on outside click, not inside', () => {
    const modal = {
      isSelectionOpen: false,
      isEditorOpen: false,
      closeSelection: vi.fn(),
      closeEditor: vi.fn()
    }
    const { getByTestId } = render(<Harness isDrawerOpen modalState={modal} />)
    const outside = getByTestId('outside')
    const inside = getByTestId('bar')

    fireEvent.mouseDown(inside)
    expect((window as any).__closeDrawer).not.toHaveBeenCalled()

    fireEvent.mouseDown(outside)
    expect((window as any).__closeDrawer).toHaveBeenCalledTimes(1)
  })

  it('Escape closes editor if open', () => {
    const modal = {
      isSelectionOpen: false,
      isEditorOpen: true,
      closeSelection: vi.fn(),
      closeEditor: vi.fn()
    }
    render(<Harness isDrawerOpen modalState={modal} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(modal.closeEditor).toHaveBeenCalled()
    expect(modal.closeSelection).not.toHaveBeenCalled()
    expect((window as any).__closeDrawer).not.toHaveBeenCalled()
  })

  it('Escape closes selection if open (and editor closed)', () => {
    const modal = {
      isSelectionOpen: true,
      isEditorOpen: false,
      closeSelection: vi.fn(),
      closeEditor: vi.fn()
    }
    render(<Harness isDrawerOpen modalState={modal} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(modal.closeSelection).toHaveBeenCalled()
    expect(modal.closeEditor).not.toHaveBeenCalled()
    expect((window as any).__closeDrawer).not.toHaveBeenCalled()
  })

  it('Escape closes drawer if no modals open', () => {
    const modal = {
      isSelectionOpen: false,
      isEditorOpen: false,
      closeSelection: vi.fn(),
      closeEditor: vi.fn()
    }
    render(<Harness isDrawerOpen modalState={modal} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect((window as any).__closeDrawer).toHaveBeenCalled()
  })
})
