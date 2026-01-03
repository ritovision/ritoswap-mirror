import type { CSSProperties, KeyboardEvent, RefObject } from 'react'
import type { TOCItem } from '@Contexts/TOCContext'
import { HEIGHT_ANIM_MS } from '../utils/constants'
import type { ActiveTab } from '../hooks/useDrawerController'
import TOCDrawer from '../drawers/TOCDrawer/TOCDrawer'
import AIDrawer from '../drawers/AIDrawer/AIDrawer'
import styles from '../BottomBar.module.css'

interface DrawerProps {
  activeTab: ActiveTab
  isDrawerOpen: boolean
  drawerHeight: number
  needsOverflow: boolean
  drawerRef: RefObject<HTMLDivElement>
  tocPanelRef: RefObject<HTMLDivElement>
  aiPanelRef: RefObject<HTMLDivElement>
  tocInnerRef: RefObject<HTMLDivElement>
  aiInnerRef: RefObject<HTMLDivElement>
  toc: TOCItem[] | undefined
  activeId: string
  onHeadingClick: (id: string) => void
  onHeadingKeyDown: (event: KeyboardEvent, id: string) => void
  onPromptSelect: () => void
}

export function Drawer({
  activeTab,
  isDrawerOpen,
  drawerHeight,
  needsOverflow,
  drawerRef,
  tocPanelRef,
  aiPanelRef,
  tocInnerRef,
  aiInnerRef,
  toc,
  activeId,
  onHeadingClick,
  onHeadingKeyDown,
  onPromptSelect
}: DrawerProps) {
  const drawerAnimatedStyle: CSSProperties | undefined = isDrawerOpen
    ? {
        height: drawerHeight,
        transition: `height ${HEIGHT_ANIM_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        overflowY: needsOverflow ? 'auto' : 'hidden'
      }
    : undefined

  const panelStyle = (active: boolean): CSSProperties => ({
    position: 'absolute',
    inset: 0,
    opacity: active ? 1 : 0,
    transition: 'opacity 200ms linear',
    pointerEvents: active ? 'auto' : 'none',
    display: 'flex',
    justifyContent: 'center'
  })

  return (
    <div
      ref={drawerRef}
      className={`${styles.drawerContent} ${isDrawerOpen ? styles.open : ''}`}
      style={drawerAnimatedStyle}
    >
      <div className={styles.drawerPanels}>
        <div ref={tocPanelRef} style={panelStyle(activeTab === 'toc')}>
          <div ref={tocInnerRef} className={styles.drawerInner}>
            <TOCDrawer
              toc={toc || []}
              activeId={activeId}
              onHeadingClick={onHeadingClick}
              onKeyDown={onHeadingKeyDown}
            />
          </div>
        </div>

        <div ref={aiPanelRef} style={panelStyle(activeTab === 'ai')}>
          <div ref={aiInnerRef} className={styles.drawerInner}>
            <AIDrawer onPromptSelect={onPromptSelect} />
          </div>
        </div>
      </div>
    </div>
  )
}
