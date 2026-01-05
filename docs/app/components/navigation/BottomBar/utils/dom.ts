import { DRAWER_MAX_HEIGHT_RATIO } from './constants'

export function clampToDrawerCap(px: number): number {
  if (typeof window === 'undefined') return px
  const cap = Math.round(window.innerHeight * DRAWER_MAX_HEIGHT_RATIO)
  return Math.max(0, Math.min(px, cap))
}

const isElementVisible = (el: HTMLElement): boolean =>
  el.offsetParent !== null || el.getClientRects().length > 0

const scoreCandidate = (el: HTMLElement): number => {
  if (el.closest('aside')) return 0
  if (el.closest('header')) return 1
  return 2
}

export function findNativeSidebarButton(
  excludeRoot?: HTMLElement | null
): HTMLButtonElement | null {
  if (typeof document === 'undefined') return null

  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('button[aria-controls][aria-expanded]')
  )

  const filtered = buttons
    .filter((button) => {
      if (excludeRoot && excludeRoot.contains(button)) return false
      return isElementVisible(button)
    })
    .sort((a, b) => scoreCandidate(a) - scoreCandidate(b))

  return filtered[0] ?? null
}
