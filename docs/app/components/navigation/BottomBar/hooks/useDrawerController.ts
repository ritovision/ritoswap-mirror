import { useCallback, useRef, useState } from 'react'
import { clampToDrawerCap } from '../utils/dom'
import { HEIGHT_ANIM_MS } from '../utils/constants'

export type ActiveTab = 'toc' | 'ai'

interface DrawerControllerOptions {
  hasTOC: boolean
}

export function useDrawerController({ hasTOC }: DrawerControllerOptions) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('toc')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerHeight, setDrawerHeight] = useState(0)
  const [needsOverflow, setNeedsOverflow] = useState(false)

  const drawerRef = useRef<HTMLDivElement>(null)
  const tocPanelRef = useRef<HTMLDivElement>(null)
  const aiPanelRef = useRef<HTMLDivElement>(null)
  const tocInnerRef = useRef<HTMLDivElement>(null)
  const aiInnerRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<number | null>(null)

  const cancelCloseTimer = useCallback(() => {
    if (typeof window === 'undefined') return
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const updateHeightToActive = useCallback(() => {
    if (!isDrawerOpen) return
    const inner = activeTab === 'toc' ? tocInnerRef.current : aiInnerRef.current
    if (!inner) return
    const actualHeight = inner.scrollHeight
    const measured = clampToDrawerCap(actualHeight)
    setDrawerHeight(measured)
    // Only need overflow if content exceeds the clamped height
    setNeedsOverflow(actualHeight > measured)
  }, [activeTab, isDrawerOpen])

  const openDrawer = useCallback(
    (tab: ActiveTab) => {
      cancelCloseTimer()
      setActiveTab(tab)
      setDrawerHeight(0)
      setNeedsOverflow(false)
      setIsDrawerOpen(true)
      if (typeof window === 'undefined') return
      requestAnimationFrame(() => {
        drawerRef.current?.getBoundingClientRect()
        // Directly measure height here to avoid stale closure issues
        const inner = tab === 'toc' ? tocInnerRef.current : aiInnerRef.current
        if (inner) {
          const actualHeight = inner.scrollHeight
          const measured = clampToDrawerCap(actualHeight)
          setDrawerHeight(measured)
          // Only need overflow if content exceeds the clamped height
          setNeedsOverflow(actualHeight > measured)
        }
      })
    },
    [cancelCloseTimer]
  )

  const closeDrawer = useCallback(() => {
    if (!isDrawerOpen || typeof window === 'undefined') return
    cancelCloseTimer()
    setDrawerHeight(0)
    closeTimerRef.current = window.setTimeout(() => {
      setIsDrawerOpen(false)
      closeTimerRef.current = null
    }, HEIGHT_ANIM_MS)
  }, [cancelCloseTimer, isDrawerOpen])

  const toggleTOC = useCallback(() => {
    if (!hasTOC) return
    if (isDrawerOpen && activeTab === 'toc') {
      closeDrawer()
    } else if (isDrawerOpen) {
      setActiveTab('toc')
    } else {
      openDrawer('toc')
    }
  }, [activeTab, closeDrawer, hasTOC, isDrawerOpen, openDrawer])

  const toggleAI = useCallback(() => {
    if (isDrawerOpen && activeTab === 'ai') {
      closeDrawer()
    } else if (isDrawerOpen) {
      setActiveTab('ai')
    } else {
      openDrawer('ai')
    }
  }, [activeTab, closeDrawer, isDrawerOpen, openDrawer])

  return {
    activeTab,
    isDrawerOpen,
    drawerHeight,
    needsOverflow,
    drawerRef,
    tocPanelRef,
    aiPanelRef,
    tocInnerRef,
    aiInnerRef,
    openDrawer,
    closeDrawer,
    toggleTOC,
    toggleAI,
    updateHeightToActive,
    cancelCloseTimer
  }
}
