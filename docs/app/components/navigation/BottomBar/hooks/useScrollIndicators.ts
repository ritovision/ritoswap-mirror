import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FOOTER_NEAR_RATIO,
  SCROLL_BOTTOM_OFFSET,
  SCROLL_FADE_RESET_MS,
  SCROLL_TOP_THRESHOLD
} from '../utils/constants'
import type { ScrollButtonsProps } from '../components/ScrollButtons/ScrollButtons'

interface UseScrollIndicatorsOptions {
  onScrollInteraction?: () => void
  isDrawerOpen?: boolean
}

type FadeTarget = 'up' | 'down' | 'both'

export function useScrollIndicators({
  onScrollInteraction,
  isDrawerOpen = false
}: UseScrollIndicatorsOptions = {}) {
  const [isAtTop, setIsAtTop] = useState(true)
  const [isAtBottom, setIsAtBottom] = useState(false)
  const [isNearFooter, setIsNearFooter] = useState(false)

  const [scrollUpHover, setScrollUpHover] = useState(false)
  const [scrollUpActive, setScrollUpActive] = useState(false)
  const [scrollUpSticky, setScrollUpSticky] = useState(false)
  const [scrollDownHover, setScrollDownHover] = useState(false)
  const [scrollDownActive, setScrollDownActive] = useState(false)
  const [scrollDownSticky, setScrollDownSticky] = useState(false)

  const upRef = useRef<HTMLButtonElement>(null)
  const downRef = useRef<HTMLButtonElement>(null)
  const upFadeTimer = useRef<number | null>(null)
  const downFadeTimer = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleScroll = () => {
      const scrollY = window.scrollY
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight

      setIsAtTop(scrollY < SCROLL_TOP_THRESHOLD)
      setIsAtBottom(scrollY + windowHeight >= documentHeight - SCROLL_BOTTOM_OFFSET)
      setIsNearFooter((scrollY + windowHeight) / documentHeight > FOOTER_NEAR_RATIO)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const clearAfterFade = useCallback(
    (target: FadeTarget) => {
      if (typeof window === 'undefined') return

      if (target === 'up' || target === 'both') {
        if (upFadeTimer.current) window.clearTimeout(upFadeTimer.current)
        upFadeTimer.current = window.setTimeout(() => {
          upRef.current?.blur()
          setScrollUpHover(false)
          setScrollUpActive(false)
          setScrollUpSticky(false)
        }, SCROLL_FADE_RESET_MS)
      }

      if (target === 'down' || target === 'both') {
        if (downFadeTimer.current) window.clearTimeout(downFadeTimer.current)
        downFadeTimer.current = window.setTimeout(() => {
          downRef.current?.blur()
          setScrollDownHover(false)
          setScrollDownActive(false)
          setScrollDownSticky(false)
        }, SCROLL_FADE_RESET_MS)
      }
    },
    []
  )

  const scrollToTop = useCallback(() => {
    if (typeof window === 'undefined') return
    setScrollUpSticky(true)
    onScrollInteraction?.()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [onScrollInteraction])

  const scrollToBottom = useCallback(() => {
    if (typeof window === 'undefined') return
    setScrollDownSticky(true)
    onScrollInteraction?.()
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth'
    })
  }, [onScrollInteraction])

  useEffect(() => {
    if (isAtTop && scrollUpSticky) clearAfterFade('up')
  }, [clearAfterFade, isAtTop, scrollUpSticky])

  useEffect(() => {
    if (isAtBottom && scrollDownSticky) clearAfterFade('down')
  }, [clearAfterFade, isAtBottom, scrollDownSticky])

  useEffect(() => {
    if (isNearFooter && (scrollUpSticky || scrollDownSticky)) {
      clearAfterFade('both')
    }
  }, [clearAfterFade, isNearFooter, scrollDownSticky, scrollUpSticky])

  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') return
      if (upFadeTimer.current) window.clearTimeout(upFadeTimer.current)
      if (downFadeTimer.current) window.clearTimeout(downFadeTimer.current)
    }
  }, [])

  const scrollButtonsProps = useMemo<ScrollButtonsProps>(
    () => ({
      isAtTop,
      isAtBottom,
      scrollUpHover,
      scrollUpActive,
      scrollUpSticky,
      scrollDownHover,
      scrollDownActive,
      scrollDownSticky,
      onScrollUp: scrollToTop,
      onScrollDown: scrollToBottom,
      onScrollUpMouseEnter: () => setScrollUpHover(true),
      onScrollUpMouseLeave: () => {
        setScrollUpHover(false)
        setScrollUpActive(false)
      },
      onScrollUpMouseDown: () => setScrollUpActive(true),
      onScrollUpMouseUp: () => setScrollUpActive(false),
      onScrollUpTouchStart: () => {
        setScrollUpHover(true)
        setScrollUpActive(true)
      },
      onScrollUpTouchEnd: () => {
        setScrollUpHover(false)
        setScrollUpActive(false)
      },
      onScrollUpTouchCancel: () => {
        setScrollUpHover(false)
        setScrollUpActive(false)
      },
      onScrollDownMouseEnter: () => setScrollDownHover(true),
      onScrollDownMouseLeave: () => {
        setScrollDownHover(false)
        setScrollDownActive(false)
      },
      onScrollDownMouseDown: () => setScrollDownActive(true),
      onScrollDownMouseUp: () => setScrollDownActive(false),
      onScrollDownTouchStart: () => {
        setScrollDownHover(true)
        setScrollDownActive(true)
      },
      onScrollDownTouchEnd: () => {
        setScrollDownHover(false)
        setScrollDownActive(false)
      },
      onScrollDownTouchCancel: () => {
        setScrollDownHover(false)
        setScrollDownActive(false)
      },
      upRef,
      downRef
    }),
    [
      isAtTop,
      isAtBottom,
      scrollUpHover,
      scrollUpActive,
      scrollUpSticky,
      scrollDownHover,
      scrollDownActive,
      scrollDownSticky,
      scrollToTop,
      scrollToBottom
    ]
  )

  return {
    isNearFooter: isNearFooter && !isDrawerOpen,
    scrollButtonsProps
  }
}
