import { useState, useRef } from 'react'
import styles from '../BottomBar.module.css'

interface TOCButtonProps {
  isActive: boolean
  hasTOC: boolean
  onToggle: () => void
  ariaExpanded: boolean
}

export function TOCButton({ isActive, hasTOC, onToggle, ariaExpanded }: TOCButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [hover, setHover] = useState(false)
  const [pressed, setPressed] = useState(false)

  const className = [
    styles.tocButton,
    !hasTOC ? styles.disabled : '',
    hasTOC && (hover || isActive) ? styles.hover : '',
    hasTOC && pressed ? styles.active : ''
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
        if (!hasTOC) return
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
      onMouseEnter={() => hasTOC && setHover(true)}
      onMouseLeave={() => {
        setHover(false)
        setPressed(false)
      }}
      onMouseDown={() => hasTOC && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      disabled={!hasTOC}
      aria-label="Toggle table of contents"
      aria-expanded={hasTOC ? ariaExpanded : false}
    >
      <span
        className={[
          styles.caret,
          isActive ? styles.rotated : ''
        ]
          .filter(Boolean)
          .join(' ')}
      >
        ▲
      </span>
      <span className={styles.tocLabel}>On This Page</span>
    </button>
  )
}
