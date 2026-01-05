'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { usePromptStore } from '@Stores/promptStore'
import { openAIDeeplink } from '@/app/components/navigation/BottomBar/utils/aiDeeplinks'
import { copyPageAsMarkdown } from '@/app/components/navigation/BottomBar/utils/markdownCopy'
import styles from './AIDrawer.module.css'

interface AIDrawerProps {
  onPromptSelect: () => void
}

type StatusPhase = 'in' | 'out' | null

type StatusKind = 'success' | 'error'

interface StatusDetails {
  text: string
  type: StatusKind
}

export default function AIDrawer({ onPromptSelect }: AIDrawerProps) {
  // Prevent hydration mismatch by only showing stored prompt name after client-side mount
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      setMounted(true)
    })

    return () => {
      window.cancelAnimationFrame(id)
    }
  }, [])

  const activePrompt = usePromptStore((state) => state.getActivePrompt())
  const promptName = mounted ? activePrompt?.name || 'None' : 'Default'
  const promptText = activePrompt?.text || ''

  // UI state for the transient status flow
  const [primaryHiddenNow, setPrimaryHiddenNow] = useState(false)
  const [status, setStatus] = useState<StatusDetails | null>(null)
  const [statusPhase, setStatusPhase] = useState<StatusPhase>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  const runStatusFlow = (ok: boolean) => {
    // Reset any in-flight animations
    clearTimers()

    // Instantly hide the primary label (no fade)
    setPrimaryHiddenNow(true)

    // Announce status and start fade-in immediately
    setStatus({
      text: ok ? 'Copied!' : 'Failed to Copy!',
      type: ok ? 'success' : 'error'
    })
    setStatusPhase('in')

    // After the 0.25s fade-in completes, hold for 2s
    timers.current.push(
      setTimeout(() => {
        // Hold visible for 2 seconds
        timers.current.push(
          setTimeout(() => {
            // Then fade out over 0.75s
            setStatusPhase('out')

            // After fade-out completes, restore the primary label with a 0.25s fade-in (handled via CSS)
            timers.current.push(
              setTimeout(() => {
                setStatus(null)
                setStatusPhase(null)
                setPrimaryHiddenNow(false)
              }, 750) // matches fade-out duration
            )
          }, 2000) // hold duration
        )
      }, 250) // matches fade-in duration
    )
  }

  const handleCopyMarkdown = async () => {
    try {
      await copyPageAsMarkdown()
      runStatusFlow(true)
    } catch (error) {
      console.error('Failed to copy markdown:', error)
      runStatusFlow(false)
    }
  }

  const handleAIClick = (provider: 'chatgpt' | 'claude' | 'perplexity') => {
    const pageUrl = window.location.href
    openAIDeeplink(provider, promptText, pageUrl)
  }

  return (
    <div className={styles.aiDrawerContent}>
      <div className={styles.aiButtons}>
        {/* Copy Markdown Button */}
        <button
          className={`${styles.aiDrawerButton} ${styles.copyButton}`}
          onClick={handleCopyMarkdown}
          aria-label="Copy page as markdown"
        >
          <span
            className={[
              styles.buttonIconWrap,
              primaryHiddenNow ? styles.hiddenNow : ''
            ].join(' ')}
          >
            <svg
              className={styles.buttonIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </span>

          {/* Text stack: primary label + transient status label */}
          <span className={styles.statusLabelWrap}>
            <span
              className={[
                styles.primaryLabel,
                primaryHiddenNow ? styles.hiddenNow : ''
              ].join(' ')}
            >
              Copy Page as Markdown
            </span>

            {/*
              Status label appears on top and handles its own fade-in/out.
              Screen-reader friendly with aria-live.
            */}
            <span
              className={[
                styles.statusLabel,
                statusPhase === 'in' ? styles.statusIn : '',
                statusPhase === 'out' ? styles.statusOut : ''
              ].join(' ')}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {status?.type === 'success' && (
                <svg
                  className={styles.statusIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
              {status?.text ?? ''}
            </span>
          </span>
        </button>

        {/* Prompt Selection Button */}
        <button
          className={`${styles.aiDrawerButton} ${styles.promptButton}`}
          onClick={onPromptSelect}
          aria-label="Select AI prompt"
        >
          <span className={styles.promptButtonText}>Prompt Selected: {promptName}</span>
        </button>

        {/* ChatGPT Button */}
        <button
          className={`${styles.aiDrawerButton} ${styles.chatgptButton}`}
          onClick={() => handleAIClick('chatgpt')}
          aria-label="Ask ChatGPT"
        >
          <Image
            src="/images/logos/ChatGPT-logo-white.png"
            alt=""
            width={24}
            height={24}
            className={styles.providerLogo}
            aria-hidden="true"
          />
          <span>Ask ChatGPT</span>
        </button>

        {/* Claude Button */}
        <button
          className={`${styles.aiDrawerButton} ${styles.claudeButton}`}
          onClick={() => handleAIClick('claude')}
          aria-label="Ask Claude"
        >
          <Image
            src="/images/logos/claude-logo-white.png"
            alt=""
            width={24}
            height={24}
            className={styles.providerLogo}
            aria-hidden="true"
          />
          <span>Ask Claude</span>
        </button>

        {/* Perplexity Button */}
        <button
          className={`${styles.aiDrawerButton} ${styles.perplexityButton}`}
          onClick={() => handleAIClick('perplexity')}
          aria-label="Ask Perplexity"
        >
          <Image
            src="/images/logos/perplexity-logo-white.png"
            alt=""
            width={24}
            height={24}
            className={styles.providerLogo}
            aria-hidden="true"
          />
          <span>Ask Perplexity</span>
        </button>
      </div>

      <p className={styles.privacyNote}>
        RitoSwap Docs does not store, collect or access any of your conversations. All saved prompts are stored locally in your browser only.
      </p>
    </div>
  )
}
