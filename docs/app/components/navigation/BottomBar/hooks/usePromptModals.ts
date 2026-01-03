import { useCallback, useState } from 'react'
import type { Prompt } from '@Stores/promptStore'

export function usePromptModals() {
  const [isSelectionOpen, setSelectionOpen] = useState(false)
  const [isEditorOpen, setEditorOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)

  const openSelection = useCallback(() => {
    setSelectionOpen(true)
  }, [])

  const closeSelection = useCallback(() => {
    setSelectionOpen(false)
  }, [])

  const startCreateNew = useCallback(() => {
    setSelectionOpen(false)
    setEditingPrompt(null)
    setEditorOpen(true)
  }, [])

  const startEdit = useCallback((prompt: Prompt) => {
    setSelectionOpen(false)
    setEditingPrompt(prompt)
    setEditorOpen(true)
  }, [])

  const closeEditor = useCallback(() => {
    setEditorOpen(false)
    setEditingPrompt(null)
  }, [])

  const backToSelection = useCallback(() => {
    setEditorOpen(false)
    setSelectionOpen(true)
  }, [])

  return {
    isSelectionOpen,
    openSelection,
    closeSelection,
    isEditorOpen,
    openEditor: startEdit,
    startCreateNew,
    closeEditor,
    backToSelection,
    editingPrompt
  }
}
