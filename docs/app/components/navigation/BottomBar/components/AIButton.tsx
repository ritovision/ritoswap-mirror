import Image from 'next/image'
import { useState, useRef } from 'react'
import styles from '../BottomBar.module.css'

interface AIButtonProps {
  variant: 'icon' | 'full'
  isActive: boolean
  onToggle: () => void
  ariaExpanded: boolean
}

export function AIButton({ variant, isActive, onToggle, ariaExpanded }: AIButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [hover, setHover] = useState(false)
  const [pressed, setPressed] = useState(false)

  const className = [
    styles.aiButton,
    variant === 'full' ? styles.aiWithText : '',
    hover || isActive ? styles.hover : '',
    pressed ? styles.active : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      ref={buttonRef}
      className={className}
      onClick={() => {
        onToggle()
        if (isActive) {
          buttonRef.current?.blur()
        }
      }}
      onTouchStart={() => {
        setPressed(true)
        setHover(true)
      }}
      onTouchEnd={() => {
        setPressed(false)
        setHover(false)
      }}
      onTouchCancel={() => {
        setPressed(false)
        setHover(false)
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false)
        setPressed(false)
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      aria-label="Toggle AI assistant"
      aria-expanded={ariaExpanded}
    >
      <Image
        src="/images/icons/ai-icon-white.png"
        alt=""
        width={24}
        height={24}
        aria-hidden="true"
      />
      {variant === 'full' && <span className={styles.aiText}>Ask AI</span>}
    </button>
  )
}
