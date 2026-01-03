import type { MouseEvent } from 'react'
import { useMemo, useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { usePromptStore, Prompt } from '@Stores/promptStore'
import ConfirmationModal from '../ConfirmationModal/ConfirmationModal'
import styles from './PromptSelectionModal.module.css'

interface PromptSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateNew: () => void
  onEdit: (prompt: Prompt) => void
}

export default function PromptSelectionModal({
  isOpen,
  onClose,
  onCreateNew,
  onEdit,
}: PromptSelectionModalProps) {
  const prompts = usePromptStore((state) => state.prompts)
  const activePromptId = usePromptStore((state) => state.activePromptId)
  const setActivePrompt = usePromptStore((state) => state.setActivePrompt)
  const deletePrompt = usePromptStore((state) => state.deletePrompt)
  const deleteAll = usePromptStore((state) => state.deleteAll)

  // Track animation state
  const [animatingPromptId, setAnimatingPromptId] = useState<string | null>(null)
  const [animationPhase, setAnimationPhase] = useState<
    'hidden' | 'showingActivated' | 'hidingActivated' | 'showingOriginal' | null
  >(null)
  const timeoutRefs = useRef<NodeJS.Timeout[]>([])

  // Track delete all confirmation
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)

  // Clean up any pending timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(clearTimeout)
      timeoutRefs.current = []
    }
  }, [])

  // Sort prompts with the currently active one first when the modal is open
  // Must be before early return to satisfy Rules of Hooks
  const sortedPrompts = useMemo(() => {
    if (!isOpen || !activePromptId) return prompts

    return [...prompts].sort((a, b) => {
      if (a.id === activePromptId) return -1
      if (b.id === activePromptId) return 1
      return 0
    })
  }, [prompts, activePromptId, isOpen])

  if (!isOpen) return null

  const handleSelectPrompt = (id: string) => {
    // Clear any existing timeouts (cancels previous animation)
    timeoutRefs.current.forEach(clearTimeout)
    timeoutRefs.current = []

    // Set the active prompt
    setActivePrompt(id)

    // Start new animation sequence
    setAnimatingPromptId(id)

    // Phase 1: Immediately hide original text
    setAnimationPhase('hidden')

    // Phase 2: Fade in "Prompt Activated!" after 0ms (immediate transition to fade-in)
    const timeout1 = setTimeout(() => {
      setAnimationPhase('showingActivated')
    }, 0)
    timeoutRefs.current.push(timeout1)

    // Phase 3: Start fading out after 250ms + 1500ms = 1750ms
    const timeout2 = setTimeout(() => {
      setAnimationPhase('hidingActivated')
    }, 1750)
    timeoutRefs.current.push(timeout2)

    // Phase 4: Show original text after fade out completes (1750ms + 750ms = 2500ms)
    const timeout3 = setTimeout(() => {
      setAnimationPhase('showingOriginal')
    }, 2500)
    timeoutRefs.current.push(timeout3)

    // Phase 5: Clear animation state after original text fades in (2500ms + 250ms = 2750ms)
    const timeout4 = setTimeout(() => {
      setAnimatingPromptId(null)
      setAnimationPhase(null)
    }, 2750)
    timeoutRefs.current.push(timeout4)
  }

  const handleDelete = (e: MouseEvent, id: string) => {
    e.stopPropagation()
    deletePrompt(id)
  }

  const handleEdit = (e: MouseEvent, prompt: Prompt) => {
    e.stopPropagation()
    onEdit(prompt)
  }

  const handleDeleteAllConfirm = () => {
    deleteAll()
    setShowDeleteAllConfirm(false)
  }

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose} />
      <div className={styles.promptModal}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Choose an Active Prompt</h3>
          <p className={styles.modalInstructions}>
            When asking an AI provider, it will autofill before the current page&apos;s URL.
          </p>
        </div>
        <div className={styles.promptList}>
          {sortedPrompts.map((prompt) => {
            const isActive = prompt.id === activePromptId
            const isAnimating = prompt.id === animatingPromptId

            // Determine CSS classes for text animation
            let promptTextClass = ''
            let activationMessageClass = ''

            if (isAnimating) {
              if (animationPhase === 'hidden') {
                promptTextClass = styles.promptTextHidden
              } else if (animationPhase === 'showingActivated') {
                promptTextClass = styles.promptTextHidden
                activationMessageClass = styles.activatedTextIn
              } else if (animationPhase === 'hidingActivated') {
                promptTextClass = styles.promptTextHidden
                activationMessageClass = styles.activatedTextOut
              } else if (animationPhase === 'showingOriginal') {
                promptTextClass = styles.promptTextIn
              }
            }

            return (
              <div
                key={prompt.id}
                className={`${styles.promptListButton} ${isActive ? styles.activePrompt : ''}`}
                onClick={() => handleSelectPrompt(prompt.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleSelectPrompt(prompt.id)
                  }
                }}
              >
                <div className={styles.promptTextWrapper}>
                  <span className={`${styles.promptListText} ${promptTextClass}`}>
                    <span className={styles.promptName}>{prompt.name}</span>
                    {' - '}
                    <span className={styles.promptText}>{prompt.text}</span>
                  </span>
                  {isAnimating && (
                    <span className={`${styles.activationMessage} ${activationMessageClass}`}>
                      Prompt Activated!
                    </span>
                  )}
                </div>
                <div className={styles.promptActions}>
                  <button
                    className={styles.promptActionButton}
                    onClick={(e) => handleEdit(e, prompt)}
                    aria-label="Edit prompt"
                  >
                    <Image
                      src="/images/icons/edit.svg"
                      alt=""
                      width={16}
                      height={16}
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    className={`${styles.promptActionButton} ${styles.deleteButton}`}
                    onClick={(e) => handleDelete(e, prompt.id)}
                    aria-label="Delete prompt"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 875 1000"
                      aria-hidden="true"
                    >
                      <path
                        fill="currentColor"
                        d="M0 281.296l0 -68.355q1.953 -37.107 29.295 -62.496t64.449 -25.389l93.744 0l0 -31.248q0 -39.06 27.342 -66.402t66.402 -27.342l312.48 0q39.06 0 66.402 27.342t27.342 66.402l0 31.248l93.744 0q37.107 0 64.449 25.389t29.295 62.496l0 68.355q0 25.389 -18.553 43.943t-43.943 18.553l0 531.216q0 52.731 -36.13 88.862t-88.862 36.13l-499.968 0q-52.731 0 -88.862 -36.13t-36.13 -88.862l0 -531.216q-25.389 0 -43.943 -18.553t-18.553 -43.943zm62.496 0l749.952 0l0 -62.496q0 -13.671 -8.789 -22.46t-22.46 -8.789l-687.456 0q-13.671 0 -22.46 8.789t-8.789 22.46l0 62.496zm62.496 593.712q0 25.389 18.553 43.943t43.943 18.553l499.968 0q25.389 0 43.943 -18.553t18.553 -43.943l0 -531.216l-624.96 0l0 531.216zm62.496 -31.248l0 -406.224q0 -13.671 8.789 -22.46t22.46 -8.789l62.496 0q13.671 0 22.46 8.789t8.789 22.46l0 406.224q0 13.671 -8.789 22.46t-22.46 8.789l-62.496 0q-13.671 0 -22.46 -8.789t-8.789 -22.46zm31.248 0l62.496 0l0 -406.224l-62.496 0l0 406.224zm31.248 -718.704l374.976 0l0 -31.248q0 -13.671 -8.789 -22.46t-22.46 -8.789l-312.48 0q-13.671 0 -22.46 8.789t-8.789 22.46l0 31.248zm124.992 718.704l0 -406.224q0 -13.671 8.789 -22.46t22.46 -8.789l62.496 0q13.671 0 22.46 8.789t8.789 22.46l0 406.224q0 13.671 -8.789 22.46t-22.46 8.789l-62.496 0q-13.671 0 -22.46 -8.789t-8.789 -22.46zm31.248 0l62.496 0l0 -406.224l-62.496 0l0 406.224zm156.24 0l0 -406.224q0 -13.671 8.789 -22.46t-22.46 -8.789l62.496 0q13.671 0 22.46 8.789t8.789 22.46l0 406.224q0 13.671 -8.789 22.46t-22.46 8.789l-62.496 0q-13.671 0 -22.46 -8.789t-8.789 -22.46zm31.248 0l62.496 0l0 -406.224l-62.496 0l0 406.224z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className={styles.promptModalFooter}>
          <button
            className={styles.promptFooterButton}
            onClick={onClose}
            aria-label="Go back"
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

          <button
            className={styles.promptFooterButton}
            onClick={onCreateNew}
          >
            + Create Prompt
          </button>

          <button
            className={`${styles.promptFooterButton} ${styles.deleteAllButton}`}
            onClick={() => setShowDeleteAllConfirm(true)}
          >
            <span>Delete All</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 875 1000"
              className={styles.trashIcon}
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M0 281.296l0 -68.355q1.953 -37.107 29.295 -62.496t64.449 -25.389l93.744 0l0 -31.248q0 -39.06 27.342 -66.402t66.402 -27.342l312.48 0q39.06 0 66.402 27.342t27.342 66.402l0 31.248l93.744 0q37.107 0 64.449 25.389t29.295 62.496l0 68.355q0 25.389 -18.553 43.943t-43.943 18.553l0 531.216q0 52.731 -36.13 88.862t-88.862 36.13l-499.968 0q-52.731 0 -88.862 -36.13t-36.13 -88.862l0 -531.216q-25.389 0 -43.943 -18.553t-18.553 -43.943zm62.496 0l749.952 0l0 -62.496q0 -13.671 -8.789 -22.46t-22.46 -8.789l-687.456 0q-13.671 0 -22.46 8.789t-8.789 22.46l0 62.496zm62.496 593.712q0 25.389 18.553 43.943t43.943 18.553l499.968 0q25.389 0 43.943 -18.553t18.553 -43.943l0 -531.216l-624.96 0l0 531.216zm62.496 -31.248l0 -406.224q0 -13.671 8.789 -22.46t22.46 -8.789l62.496 0q13.671 0 22.46 8.789t8.789 22.46l0 406.224q0 13.671 -8.789 22.46t-22.46 8.789l-62.496 0q-13.671 0 -22.46 -8.789t-8.789 -22.46zm31.248 0l62.496 0l0 -406.224l-62.496 0l0 406.224zm31.248 -718.704l374.976 0l0 -31.248q0 -13.671 -8.789 -22.46t-22.46 -8.789l-312.48 0q-13.671 0 -22.46 8.789t-8.789 22.46l0 31.248zm124.992 718.704l0 -406.224q0 -13.671 8.789 -22.46t22.46 -8.789l62.496 0q13.671 0 22.46 8.789t8.789 22.46l0 406.224q0 13.671 -8.789 22.46t-22.46 8.789l-62.496 0q-13.671 0 -22.46 -8.789t-8.789 -22.46zm31.248 0l62.496 0l0 -406.224l-62.496 0l0 406.224zm156.24 0l0 -406.224q0 -13.671 8.789 -22.46t-22.46 -8.789l62.496 0q13.671 0 22.46 8.789t8.789 22.46l0 406.224q0 13.671 -8.789 22.46t-22.46 8.789l-62.496 0q-13.671 0 -22.46 -8.789t-8.789 -22.46zm31.248 0l62.496 0l0 -406.224l-62.496 0l0 406.224z"
              />
            </svg>
          </button>
        </div>

        {/* Confirmation Modal for Delete All */}
        <ConfirmationModal
          isOpen={showDeleteAllConfirm}
          message="Delete all saved prompts?"
          onConfirm={handleDeleteAllConfirm}
          onCancel={() => setShowDeleteAllConfirm(false)}
        />
      </div>
    </>
  )
}
