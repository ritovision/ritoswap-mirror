'use client'

import type { KeyboardEvent } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useTOC } from '@Contexts/TOCContext'
import styles from './BottomBar.module.css'
import { Drawer } from './components/Drawer'
import { SidebarToggle } from './components/SidebarToggle'
import { AIButton } from './components/AIButton'
import { TOCButton } from './components/TOCButton'
import ScrollButtons from './components/ScrollButtons/ScrollButtons'
import PromptSelectionModal from './modals/PromptSelectionModal/PromptSelectionModal'
import PromptEditModal from './modals/PromptEditModal/PromptEditModal'
import { useDrawerController } from './hooks/useDrawerController'
import { useScrollIndicators } from './hooks/useScrollIndicators'
import { useSidebarBridge } from './hooks/useSidebarBridge'
import { usePromptModals } from './hooks/usePromptModals'
import { useDrawerDismiss } from './hooks/useDrawerDismiss'
import { useActiveHeading } from './hooks/useActiveHeading'

export default function BottomBar() {
  const barRef = useRef<HTMLDivElement>(null)
  const { toc } = useTOC()
  const hasTOC = !!toc && toc.length > 0

  const drawer = useDrawerController({ hasTOC })
  const modals = usePromptModals()
  const sidebar = useSidebarBridge({ barRef: barRef as React.RefObject<HTMLDivElement> })
  const activeId = useActiveHeading({ toc, enabled: hasTOC })

  const handleScrollInteraction = useCallback(() => {
    if (drawer.isDrawerOpen) drawer.closeDrawer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawer.isDrawerOpen, drawer.closeDrawer])

  const { isNearFooter, scrollButtonsProps } = useScrollIndicators({
    onScrollInteraction: handleScrollInteraction,
    isDrawerOpen: drawer.isDrawerOpen
  })

  useDrawerDismiss({
    isDrawerOpen: drawer.isDrawerOpen,
    barRef: barRef as React.RefObject<HTMLDivElement>,
    closeDrawer: drawer.closeDrawer,
    modals: {
      isSelectionOpen: modals.isSelectionOpen,
      closeSelection: modals.closeSelection,
      isEditorOpen: modals.isEditorOpen,
      closeEditor: modals.closeEditor
    }
  })

  useLayoutEffect(() => {
    if (!drawer.isDrawerOpen) return
    if (typeof window === 'undefined') return
    const frame = window.requestAnimationFrame(() => drawer.updateHeightToActive())
    return () => window.cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawer.activeTab, drawer.isDrawerOpen, drawer.updateHeightToActive, toc, modals.isSelectionOpen, modals.isEditorOpen])

  useEffect(() => {
    if (!drawer.isDrawerOpen || typeof window === 'undefined') return
    const onResize = () => drawer.updateHeightToActive()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawer.isDrawerOpen, drawer.updateHeightToActive])

  useEffect(
    () => () => drawer.cancelCloseTimer(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drawer.cancelCloseTimer]
  )

  const handleTOCItemClick = useCallback(
    (id: string) => {
      if (typeof document === 'undefined') return
      const element = document.getElementById(id)
      if (!element) return

      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      if (typeof window !== 'undefined') {
        window.setTimeout(() => drawer.closeDrawer(), 300)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drawer.closeDrawer]
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent, id: string) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        handleTOCItemClick(id)
      }
    },
    [handleTOCItemClick]
  )

  return (
    <div
      ref={barRef}
      data-bottom-bar
      className={`${styles.bottomBar} ${isNearFooter ? styles.fadeOut : ''}`}
      suppressHydrationWarning
    >
      <Drawer
        activeTab={drawer.activeTab}
        isDrawerOpen={drawer.isDrawerOpen}
        drawerHeight={drawer.drawerHeight}
        needsOverflow={drawer.needsOverflow}
        drawerRef={drawer.drawerRef as React.RefObject<HTMLDivElement>}
        tocPanelRef={drawer.tocPanelRef as React.RefObject<HTMLDivElement>}
        aiPanelRef={drawer.aiPanelRef as React.RefObject<HTMLDivElement>}
        tocInnerRef={drawer.tocInnerRef as React.RefObject<HTMLDivElement>}
        aiInnerRef={drawer.aiInnerRef as React.RefObject<HTMLDivElement>}
        toc={toc}
        activeId={activeId}
        onHeadingClick={handleTOCItemClick}
        onHeadingKeyDown={handleKeyDown}
        onPromptSelect={modals.openSelection}
      />

      <div className={styles.barContainer}>
        <div className={styles.leftSection}>
          <SidebarToggle
            sidebarExpanded={sidebar.sidebarExpanded}
            onToggle={sidebar.toggleSidebar}
          />
          <AIButton
            variant="icon"
            isActive={drawer.isDrawerOpen && drawer.activeTab === 'ai'}
            ariaExpanded={drawer.isDrawerOpen && drawer.activeTab === 'ai'}
            onToggle={drawer.toggleAI}
          />
        </div>

        <div className={styles.centerSection}>
          <AIButton
            variant="full"
            isActive={drawer.isDrawerOpen && drawer.activeTab === 'ai'}
            ariaExpanded={drawer.isDrawerOpen && drawer.activeTab === 'ai'}
            onToggle={drawer.toggleAI}
          />

          <TOCButton
            hasTOC={hasTOC}
            isActive={drawer.isDrawerOpen && drawer.activeTab === 'toc'}
            ariaExpanded={drawer.isDrawerOpen && drawer.activeTab === 'toc'}
            onToggle={drawer.toggleTOC}
          />
        </div>

        <div className={styles.rightSection}>
          <ScrollButtons {...scrollButtonsProps} />
        </div>
      </div>

      <PromptSelectionModal
        isOpen={modals.isSelectionOpen}
        onClose={modals.closeSelection}
        onCreateNew={modals.startCreateNew}
        onEdit={modals.openEditor}
      />

      <PromptEditModal
        isOpen={modals.isEditorOpen}
        editingPrompt={modals.editingPrompt}
        onClose={modals.closeEditor}
        onBack={modals.backToSelection}
      />
    </div>
  )
}
