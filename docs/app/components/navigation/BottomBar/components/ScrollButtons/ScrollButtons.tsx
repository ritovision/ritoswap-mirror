import type { Ref } from 'react'
import styles from './ScrollButtons.module.css'

export interface ScrollButtonsProps {
  isAtTop: boolean;
  isAtBottom: boolean;
  scrollUpHover: boolean;
  scrollUpActive: boolean;
  scrollUpSticky: boolean;
  scrollDownHover: boolean;
  scrollDownActive: boolean;
  scrollDownSticky: boolean;
  onScrollUp: () => void;
  onScrollDown: () => void;
  onScrollUpMouseEnter: () => void;
  onScrollUpMouseLeave: () => void;
  onScrollUpMouseDown: () => void;
  onScrollUpMouseUp: () => void;
  onScrollUpTouchStart: () => void;
  onScrollUpTouchEnd: () => void;
  onScrollUpTouchCancel: () => void;
  onScrollDownMouseEnter: () => void;
  onScrollDownMouseLeave: () => void;
  onScrollDownMouseDown: () => void;
  onScrollDownMouseUp: () => void;
  onScrollDownTouchStart: () => void;
  onScrollDownTouchEnd: () => void;
  onScrollDownTouchCancel: () => void;
  upRef: Ref<HTMLButtonElement>;
  downRef: Ref<HTMLButtonElement>;
}

export default function ScrollButtons({
  isAtTop,
  isAtBottom,
  scrollUpHover,
  scrollUpActive,
  scrollUpSticky,
  scrollDownHover,
  scrollDownActive,
  scrollDownSticky,
  onScrollUp,
  onScrollDown,
  onScrollUpMouseEnter,
  onScrollUpMouseLeave,
  onScrollUpMouseDown,
  onScrollUpMouseUp,
  onScrollUpTouchStart,
  onScrollUpTouchEnd,
  onScrollUpTouchCancel,
  onScrollDownMouseEnter,
  onScrollDownMouseLeave,
  onScrollDownMouseDown,
  onScrollDownMouseUp,
  onScrollDownTouchStart,
  onScrollDownTouchEnd,
  onScrollDownTouchCancel,
  upRef,
  downRef
}: ScrollButtonsProps) {
  return (
    <>
      <button
        ref={upRef}
        className={`${styles.scrollButton} ${styles.scrollUp} ${
          !isAtTop ? styles.visible : ''
        } ${scrollUpHover && !isAtTop ? styles.hover : ''} ${
          scrollUpActive && !isAtTop ? styles.active : ''
        } ${scrollUpSticky ? styles.persistActive : ''}`}
        onClick={onScrollUp}
        onTouchStart={onScrollUpTouchStart}
        onTouchEnd={onScrollUpTouchEnd}
        onTouchCancel={onScrollUpTouchCancel}
        onMouseEnter={onScrollUpMouseEnter}
        onMouseLeave={onScrollUpMouseLeave}
        onMouseDown={onScrollUpMouseDown}
        onMouseUp={onScrollUpMouseUp}
        disabled={isAtTop}
        aria-label="Scroll to top"
        tabIndex={isAtTop ? -1 : 0}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 19V7M6 13l6-6 6 6" />
        </svg>
      </button>

      <button
        ref={downRef}
        className={`${styles.scrollButton} ${styles.scrollDown} ${
          !isAtBottom ? styles.visible : ''
        } ${scrollDownHover && !isAtBottom ? styles.hover : ''} ${
          scrollDownActive && !isAtBottom ? styles.active : ''
        } ${scrollDownSticky ? styles.persistActive : ''}`}
        onClick={onScrollDown}
        onTouchStart={onScrollDownTouchStart}
        onTouchEnd={onScrollDownTouchEnd}
        onTouchCancel={onScrollDownTouchCancel}
        onMouseEnter={onScrollDownMouseEnter}
        onMouseLeave={onScrollDownMouseLeave}
        onMouseDown={onScrollDownMouseDown}
        onMouseUp={onScrollDownMouseUp}
        disabled={isAtBottom}
        aria-label="Scroll to bottom"
        tabIndex={isAtBottom ? -1 : 0}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 5v12M6 11l6 6 6-6" />
        </svg>
      </button>
    </>
  )
}
