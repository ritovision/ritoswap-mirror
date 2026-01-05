import { isMobileDevice } from '../mobile'

describe('isMobileDevice', () => {
  const originalWindow = global.window
  const originalNavigator = global.navigator

  beforeEach(() => {
    // Reset window and navigator, and make them deletable/configurable
    Object.defineProperty(global, 'window', {
      writable:     true,
      configurable: true,               // ← allow deletion in tests
      value:         { ...originalWindow },
    })
    Object.defineProperty(global, 'navigator', {
      writable:     true,
      configurable: true,               // ← allow deletion/reset in tests
      value:         { ...originalNavigator },
    })
  })

  it('should return false when window is undefined', () => {
    // now this delete will succeed
    // @ts-ignore
    delete global.window
    expect(isMobileDevice()).toBe(false)
  })

  it('should detect mobile by user agent', () => {
    Object.defineProperty(window, 'ontouchstart', { value: true })
    Object.defineProperty(window, 'innerWidth',   { value: 1024 })
    Object.defineProperty(navigator, 'userAgent', {
      value:        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      configurable: true,
    })

    expect(isMobileDevice()).toBe(true)
  })

  it('should detect mobile by small screen', () => {
    Object.defineProperty(window, 'ontouchstart', { value: true })
    Object.defineProperty(window, 'innerWidth',   { value: 600 })
    Object.defineProperty(navigator, 'userAgent', {
      value:        'Mozilla/5.0 (Windows NT 10.0)',
      configurable: true,
    })

    expect(isMobileDevice()).toBe(true)
  })

  it('should not detect desktop as mobile', () => {
    Object.defineProperty(window,    'ontouchstart', { value: undefined })
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0 })
    Object.defineProperty(window,    'innerWidth', { value: 1920 })
    Object.defineProperty(navigator, 'userAgent', {
      value:        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      configurable: true,
    })

    expect(isMobileDevice()).toBe(false)
  })

  it('should require both touch and mobile indicators', () => {
    // Has touch but large screen and desktop UA
    Object.defineProperty(window,    'ontouchstart', { value: true })
    Object.defineProperty(window,    'innerWidth',   { value: 1920 })
    Object.defineProperty(navigator, 'userAgent', {
      value:        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      configurable: true,
    })

    expect(isMobileDevice()).toBe(false)
  })
})
