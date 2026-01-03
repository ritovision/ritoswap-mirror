import { useCallback, useEffect, useRef, useState } from 'react'
import { findNativeSidebarButton } from '../utils/dom'

interface SidebarBridgeOptions {
  barRef: React.RefObject<HTMLDivElement>
}

export function useSidebarBridge({ barRef }: SidebarBridgeOptions) {
  const [sidebarExpanded, setSidebarExpanded] = useState<boolean | null>(null)
  const nativeSidebarBtnRef = useRef<HTMLButtonElement | null>(null)
  const sidebarObserverRef = useRef<MutationObserver | null>(null)

  const detachObserver = useCallback(() => {
    sidebarObserverRef.current?.disconnect()
    sidebarObserverRef.current = null
  }, [])

  const attach = useCallback(() => {
    const button = findNativeSidebarButton(barRef.current ?? undefined)
    nativeSidebarBtnRef.current = button
    detachObserver()

    if (button) {
      setSidebarExpanded(button.getAttribute('aria-expanded') === 'true')
      const observer = new MutationObserver(() => {
        setSidebarExpanded(button.getAttribute('aria-expanded') === 'true')
      })
      observer.observe(button, { attributes: true, attributeFilter: ['aria-expanded'] })
      sidebarObserverRef.current = observer
    } else {
      setSidebarExpanded(null)
    }
  }, [barRef, detachObserver])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const timeoutId = window.setTimeout(() => {
      attach()
    }, 0)

    const onResize = () => attach()
    window.addEventListener('resize', onResize)

    return () => {
      window.clearTimeout(timeoutId)
      window.removeEventListener('resize', onResize)
      detachObserver()
    }
  }, [attach, detachObserver])

  const toggleSidebar = useCallback(() => {
    if (typeof window === 'undefined') return

    const button = findNativeSidebarButton(barRef.current ?? undefined)
    if (button) {
      button.click()
      window.setTimeout(() => {
        setSidebarExpanded(button.getAttribute('aria-expanded') === 'true')
      }, 0)
    } else {
      window.dispatchEvent(new CustomEvent('nextra:toggleSidebar'))
    }
  }, [barRef])

  return {
    sidebarExpanded,
    toggleSidebar
  }
}
