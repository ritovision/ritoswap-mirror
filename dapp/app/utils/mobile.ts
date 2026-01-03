// app/utils/mobile.ts
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false

  const override = (window as Window & { __RITOSWAP_MOBILE_OVERRIDE__?: boolean }).__RITOSWAP_MOBILE_OVERRIDE__
  if (typeof override === 'boolean') return override

  // Check for touch support
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  // Check user agent for mobile indicators
  const userAgent = navigator.userAgent.toLowerCase()
  const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'ipod', 'windows phone']
  const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword))

  // Check viewport width
  const isSmallScreen = window.innerWidth <= 768

  // Return true if any mobile indicators are present
  return hasTouch && (isMobileUA || isSmallScreen)
}
