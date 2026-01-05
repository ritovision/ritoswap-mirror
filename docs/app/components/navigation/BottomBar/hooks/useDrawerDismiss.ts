import { useEffect } from 'react'

interface DrawerDismissOptions {
  isDrawerOpen: boolean
  barRef: React.RefObject<HTMLDivElement>
  closeDrawer: () => void
  modals: {
    isSelectionOpen: boolean
    closeSelection: () => void
    isEditorOpen: boolean
    closeEditor: () => void
  }
}

export function useDrawerDismiss({
  isDrawerOpen,
  barRef,
  closeDrawer,
  modals
}: DrawerDismissOptions) {
  // Destructure modal controls so we don't depend on `modals` object identity
  const {
    isSelectionOpen,
    closeSelection,
    isEditorOpen,
    closeEditor
  } = modals

  // Click outside dismiss
  useEffect(() => {
    if (!isDrawerOpen || typeof document === 'undefined') return

    const handleClickOutside = (event: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(event.target as Node)) {
        closeDrawer()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [barRef, closeDrawer, isDrawerOpen])

  // Escape key dismiss with modal-priority logic
  useEffect(() => {
    if (!isDrawerOpen || typeof document === 'undefined') return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      if (isEditorOpen) {
        closeEditor()
      } else if (isSelectionOpen) {
        closeSelection()
      } else {
        closeDrawer()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [
    closeDrawer,
    isDrawerOpen,
    isEditorOpen,
    isSelectionOpen,
    closeEditor,
    closeSelection
  ])
}
