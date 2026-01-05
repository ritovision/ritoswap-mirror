import { useState } from 'react'
import { usePromptStore, Prompt } from '@Stores/promptStore'
import ConfirmationModal from '../ConfirmationModal/ConfirmationModal'
import styles from './PromptEditModal.module.css'

interface PromptEditModalProps {
  isOpen: boolean
  editingPrompt: Prompt | null
  onClose: () => void
  onBack: () => void
}

export default function PromptEditModal({
  isOpen,
  editingPrompt,
  onClose,
  onBack,
}: PromptEditModalProps) {
  if (!isOpen) return null

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose} />
      {/* 
        Keyed by editingPrompt id so that when you switch which prompt 
        is being edited, or go from edit -> new, the inner component 
        remounts and re-initializes its local state from props 
        without needing useEffect.
      */}
      <PromptEditContent
        key={editingPrompt?.id ?? 'new'}
        editingPrompt={editingPrompt}
        onClose={onClose}
        onBack={onBack}
      />
    </>
  )
}

interface PromptEditContentProps {
  editingPrompt: Prompt | null
  onClose: () => void
  onBack: () => void
}

function PromptEditContent({
  editingPrompt,
  onBack,
}: PromptEditContentProps) {
  const [promptText, setPromptText] = useState(editingPrompt?.text ?? '')
  const [promptName, setPromptName] = useState(editingPrompt?.name ?? '')
  const [hasError, setHasError] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const addPrompt = usePromptStore((state) => state.addPrompt)
  const updatePrompt = usePromptStore((state) => state.updatePrompt)
  const deletePrompt = usePromptStore((state) => state.deletePrompt)

  const handleSave = () => {
    const trimmedText = promptText.trim()
    const trimmedName = promptName.trim()

    if (!trimmedText || !trimmedName) {
      setHasError(true)
      return
    }

    if (editingPrompt) {
      // Update existing prompt
      updatePrompt(editingPrompt.id, {
        name: trimmedName,
        text: trimmedText,
      })
    } else {
      // Create new prompt
      addPrompt({
        name: trimmedName,
        text: trimmedText,
      })
    }

    onBack()
  }

  const handleDeleteConfirm = () => {
    if (editingPrompt) {
      deletePrompt(editingPrompt.id)
      setShowDeleteConfirm(false)
      onBack()
    }
  }

  const handleFocus = () => {
    if (hasError) {
      setHasError(false)
    }
  }

  return (
    <div className={styles.promptModal}>
      <div className={styles.editModalContent}>
        <p className={styles.editInstructions}>
          Write a prompt that will appear at the top of your AI conversations.
        </p>

        <div className={styles.formGroup}>
          <label htmlFor="promptTextArea" className={styles.formLabel}>
            Prompt Content
          </label>
          <textarea
            id="promptTextArea"
            className={`${styles.promptTextarea} ${
              hasError && !promptText.trim() ? styles.inputError : ''
            }`}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            onFocus={handleFocus}
            placeholder="Enter your prompt here..."
            rows={6}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="promptNameInput" className={styles.formLabel}>
            Prompt Name
          </label>
          <input
            id="promptNameInput"
            type="text"
            className={`${styles.promptInput} ${
              hasError && !promptName.trim() ? styles.inputError : ''
            }`}
            value={promptName}
            onChange={(e) => setPromptName(e.target.value)}
            onFocus={handleFocus}
            placeholder="Give it a name (for reference)"
          />
        </div>

        <div
          className={`${styles.editModalActions} ${
            !editingPrompt ? styles.noDelete : ''
          }`}
        >
          {/* Back Button */}
          <button
            className={`${styles.editActionButton} ${styles.backButton}`}
            onClick={onBack}
            aria-label="Go back to prompt selection"
          >
            <svg
              className={styles.arrowIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Save Button with Icon and Text */}
          <button
            className={`${styles.editActionButton} ${styles.saveButton}`}
            onClick={handleSave}
            aria-label="Save prompt"
          >
            <svg
              className={styles.checkIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              aria-hidden="true"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span>Save</span>
          </button>

          {/* Delete Button (only when editing) */}
          {editingPrompt && (
            <button
              className={`${styles.editActionButton} ${styles.deleteButton}`}
              onClick={() => setShowDeleteConfirm(true)}
              aria-label="Delete prompt"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 875 1000"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M0 281.296l0 -68.355q1.953 -37.107 29.295 -62.496t64.449 -25.389l93.744 0l0 -31.248q0 -39.06 27.342 -66.402t66.402 -27.342l312.48 0q39.06 0 66.402 27.342t27.342 66.402l0 31.248l93.744 0q37.107 0 64.449 25.389t29.295 62.496l0 68.355q0 25.389 -18.553 43.943t-43.943 18.553l0 531.216q0 52.731 -36.13 88.862t-88.862 36.13l-499.968 0q-52.731 0 -88.862 -36.13t-36.13 -88.862l0 -531.216q-25.389 0 -43.943 -18.553t-18.553 -43.943zm62.496 0l749.952 0l0 -62.496q0 -13.671 -8.789 -22.46t-22.46 -8.789l-687.456 0q-13.671 0 -22.46 8.789t-8.789 22.46l0 62.496zm62.496 593.712q0 25.389 18.553 43.943t43.943 18.553l499.968 0q25.389 0 43.943 -18.553t18.553 -43.943l0 -531.216l-624.96 0l0 531.216zm62.496 -31.248l0 -406.224q0 -13.671 8.789 -22.46t22.46 -8.789l62.496 0q13.671 0 22.46 8.789t8.789 22.46l0 406.224q0 13.671 -8.789 22.46t-22.46 8.789l-62.496 0q-13.671 0 -22.46 -8.789t-8.789 -22.46zm31.248 0l62.496 0l0 -406.224l-62.496 0l0 406.224zm31.248 -718.704l374.976 0l0 -31.248q0 -13.671 -8.789 -22.46t-22.46 -8.789l-312.48 0q-13.671 0 -22.46 8.789t-8.789 22.46l0 31.248zm124.992 718.704l0 -406.224q0 -13.671 8.789 -22.46t22.46 -8.789l62.496 0q13.671 0 22.46 8.789t8.789 22.46l0 406.224q0 13.671 -8.789 22.46t-22.46 8.789l-62.496 0q-13.671 0 -22.46 -8.789t-8.789 -22.46zm31.248 0l62.496 0l0 -406.224l-62.496 0l0 406.224zm156.24 0l0 -406.224q0 -13.671 8.789 -22.46t22.46 -8.789l62.496 0q13.671 0 22.46 8.789t8.789 22.46l0 406.224q0 13.671 -8.789 22.46t-22.46 8.789l-62.496 0q-13.671 0 -22.46 -8.789t-8.789 -22.46zm31.248 0l62.496 0l0 -406.224l-62.496 0l0 406.224z"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Delete */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        message="Delete this prompt?"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}
