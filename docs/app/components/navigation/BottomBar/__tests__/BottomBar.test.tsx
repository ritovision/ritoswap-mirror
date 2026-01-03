import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import React from 'react'
import type { TOCItem } from '@/app/contexts/TOCContext'

const mockUseTOC = vi.fn()
const mockUseDrawerDismiss = vi.fn()

let drawerControllerState: ReturnType<typeof createDrawerControllerState>
let promptModalState: ReturnType<typeof createPromptModalState>
let sidebarBridgeState: ReturnType<typeof createSidebarBridgeState>
let scrollIndicatorState: ReturnType<typeof createScrollIndicatorState>
let activeHeading = 'toc-1'

function createDrawerControllerState() {
  return {
    activeTab: 'toc' as const,
    isDrawerOpen: false,
    drawerHeight: 0,
    drawerRef: { current: null },
    tocPanelRef: { current: null },
    aiPanelRef: { current: null },
    openDrawer: vi.fn(),
    closeDrawer: vi.fn(),
    toggleTOC: vi.fn(),
    toggleAI: vi.fn(),
    updateHeightToActive: vi.fn(),
    cancelCloseTimer: vi.fn()
  }
}

function createPromptModalState() {
  const state = {
    isSelectionOpen: false,
    isEditorOpen: false,
    editingPrompt: null as unknown as { id: string } | null,
    openSelection: vi.fn(() => {
      state.isSelectionOpen = true
    }),
    closeSelection: vi.fn(() => {
      state.isSelectionOpen = false
    }),
    startCreateNew: vi.fn(() => {
      state.isSelectionOpen = false
      state.editingPrompt = null
      state.isEditorOpen = true
    }),
    openEditor: vi.fn(() => {
      state.isSelectionOpen = false
      state.isEditorOpen = true
    }),
    closeEditor: vi.fn(() => {
      state.isEditorOpen = false
      state.editingPrompt = null
    }),
    backToSelection: vi.fn(() => {
      state.isEditorOpen = false
      state.isSelectionOpen = true
    })
  }
  return state
}

function createSidebarBridgeState() {
  return {
    sidebarExpanded: true,
    toggleSidebar: vi.fn()
  }
}

function createScrollIndicatorState() {
  const noop = () => undefined
  return {
    isNearFooter: false,
    scrollButtonsProps: {
      isAtTop: true,
      isAtBottom: false,
      scrollUpHover: false,
      scrollUpActive: false,
      scrollUpSticky: false,
      scrollDownHover: false,
      scrollDownActive: false,
      scrollDownSticky: false,
      onScrollUp: noop,
      onScrollDown: noop,
      onScrollUpMouseEnter: noop,
      onScrollUpMouseLeave: noop,
      onScrollUpMouseDown: noop,
      onScrollUpMouseUp: noop,
      onScrollUpTouchStart: noop,
      onScrollUpTouchEnd: noop,
      onScrollUpTouchCancel: noop,
      onScrollDownMouseEnter: noop,
      onScrollDownMouseLeave: noop,
      onScrollDownMouseDown: noop,
      onScrollDownMouseUp: noop,
      onScrollDownTouchStart: noop,
      onScrollDownTouchEnd: noop,
      onScrollDownTouchCancel: noop,
      upRef: React.createRef<HTMLButtonElement>(),
      downRef: React.createRef<HTMLButtonElement>()
    }
  }
}

vi.mock('@/app/contexts/TOCContext', () => ({
  useTOC: () => mockUseTOC()
}))

vi.mock('@/app/components/navigation/BottomBar/hooks/useDrawerController', () => ({
  useDrawerController: () => drawerControllerState
}))

vi.mock('@/app/components/navigation/BottomBar/hooks/usePromptModals', () => ({
  usePromptModals: () => promptModalState
}))

vi.mock('@/app/components/navigation/BottomBar/hooks/useSidebarBridge', () => ({
  useSidebarBridge: () => sidebarBridgeState
}))

vi.mock('@/app/components/navigation/BottomBar/hooks/useScrollIndicators', () => ({
  useScrollIndicators: () => scrollIndicatorState
}))

vi.mock('@/app/components/navigation/BottomBar/hooks/useDrawerDismiss', () => ({
  useDrawerDismiss: (args: unknown) => {
    mockUseDrawerDismiss(args)
  }
}))

vi.mock('@/app/components/navigation/BottomBar/hooks/useActiveHeading', () => ({
  useActiveHeading: () => activeHeading
}))

vi.mock('@/app/components/navigation/BottomBar/components/Drawer', () => ({
  Drawer: (props: Record<string, unknown>) => {
    return (
      <div data-testid="drawer-proxy">
        <button
          type="button"
          data-testid="trigger-prompt-select"
          onClick={() => {
            if (typeof props.onPromptSelect === 'function') props.onPromptSelect()
          }}
        >
          open prompts
        </button>
        <button
          type="button"
          data-testid="trigger-toc-click"
          onClick={() => {
            if (typeof props.onHeadingClick === 'function') {
              props.onHeadingClick('toc-1')
            }
          }}
        >
          jump to heading
        </button>
      </div>
    )
  }
}))

vi.mock('@/app/components/navigation/BottomBar/components/ScrollButtons/ScrollButtons', () => ({
  __esModule: true,
  default: () => <div data-testid="scroll-buttons" />
}))

vi.mock('@/app/components/navigation/BottomBar/modals/PromptSelectionModal/PromptSelectionModal', () => ({
  __esModule: true,
  default: (props: { isOpen: boolean }) => (
    <div data-testid="prompt-selection" data-open={props.isOpen ? 'true' : 'false'} />
  )
}))

vi.mock('@/app/components/navigation/BottomBar/modals/PromptEditModal/PromptEditModal', () => ({
  __esModule: true,
  default: (props: { isOpen: boolean }) => (
    <div data-testid="prompt-edit" data-open={props.isOpen ? 'true' : 'false'} />
  )
}))

// Import the component under test AFTER mocks are set up
import BottomBar from '@/app/components/navigation/BottomBar/BottomBar'

describe('BottomBar', () => {
  beforeEach(() => {
    drawerControllerState = createDrawerControllerState()
    promptModalState = createPromptModalState()
    sidebarBridgeState = createSidebarBridgeState()
    scrollIndicatorState = createScrollIndicatorState()
    activeHeading = 'toc-1'

    mockUseTOC.mockReturnValue({ toc: [] as TOCItem[] })
  })

  afterEach(() => {
    // Ensure no previous renders linger and cause duplicate matches
    cleanup()
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('disables TOC controls when no table of contents exists', () => {
    const { container } = render(<BottomBar />)

    expect(
      within(container).getByRole('button', { name: /toggle table of contents/i })
    ).toBeDisabled()
    expect(mockUseDrawerDismiss).toHaveBeenCalled()
  })

  it('delegates AI toggle to drawer controller', () => {
    mockUseTOC.mockReturnValue({ toc: [{ id: 'one', value: 'One', depth: 1 }] })
    render(<BottomBar />)

    const aiButtons = screen.getAllByRole('button', { name: /toggle ai assistant/i })
    fireEvent.click(aiButtons[0])
    fireEvent.click(aiButtons[1])

    expect(drawerControllerState.toggleAI).toHaveBeenCalledTimes(2)
  })

  it('opens prompt selection through drawer interaction', () => {
    mockUseTOC.mockReturnValue({ toc: [{ id: 'one', value: 'One', depth: 1 }] })
    const { container } = render(<BottomBar />)

    fireEvent.click(within(container).getByTestId('trigger-prompt-select'))
    expect(promptModalState.openSelection).toHaveBeenCalledTimes(1)
  })

  it('toggles TOC via the button when entries exist', () => {
    mockUseTOC.mockReturnValue({ toc: [{ id: 'one', value: 'One', depth: 1 }] })
    const { container } = render(<BottomBar />)

    const button = within(container).getByRole('button', { name: /toggle table of contents/i })
    fireEvent.click(button)

    expect(drawerControllerState.toggleTOC).toHaveBeenCalledTimes(1)
  })

  it('applies fade-out styling when near footer', () => {
    scrollIndicatorState.isNearFooter = true
    const { container } = render(<BottomBar />)

    const bar = container.querySelector('[data-bottom-bar]')
    expect(bar).not.toBeNull()
    expect(bar?.className).toMatch(/fadeOut/)
  })

  it('scrolls to headings and closes drawer after jump', () => {
    mockUseTOC.mockReturnValue({ toc: [{ id: 'toc-1', value: 'Heading', depth: 1 }] })
    drawerControllerState.isDrawerOpen = true
    vi.useFakeTimers()

    const headingElement = document.createElement('div')
    headingElement.id = 'toc-1'
    headingElement.scrollIntoView = vi.fn()
    document.body.appendChild(headingElement)

    const { container } = render(<BottomBar />)

    fireEvent.click(within(container).getByTestId('trigger-toc-click'))

    expect(headingElement.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start'
    })

    vi.advanceTimersByTime(300)
    expect(drawerControllerState.closeDrawer).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
    headingElement.remove()
  })

  it('keeps modal props in sync with prompt modal state', () => {
    promptModalState.isSelectionOpen = true
    promptModalState.isEditorOpen = true
    const { container } = render(<BottomBar />)

    const selectionEls = container.querySelectorAll('[data-testid="prompt-selection"]')
    const editEls = container.querySelectorAll('[data-testid="prompt-edit"]')
    const lastSelection = selectionEls[selectionEls.length - 1] as HTMLElement
    const lastEdit = editEls[editEls.length - 1] as HTMLElement

    expect(lastSelection).toHaveAttribute('data-open', 'true')
    expect(lastEdit).toHaveAttribute('data-open', 'true')
  })
})
