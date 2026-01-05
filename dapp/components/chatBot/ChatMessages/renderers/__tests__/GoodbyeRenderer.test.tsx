// dapp/components/chatBot/ChatMessages/renderers/__tests__/GoodbyeRenderer.test.tsx
import { render, screen, act } from '@testing-library/react'
import React from 'react'

const STORAGE_KEY = 'ritoGoodbyeHardReloadAt'
const TIMER_ID_KEY = '__ritoGoodbyeHardReloadTimerId'

const importGoodbye = async () => {
  const mod = await import('../GoodbyeRenderer')
  return mod.default
}

let reloadSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
  sessionStorage.clear()
  ;(window as any)[TIMER_ID_KEY] = undefined

  // Make window.location.reload spy-able across environments
  const desc = Object.getOwnPropertyDescriptor(window, 'location')
  if (desc && !desc.configurable) {
    const original = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, reload: vi.fn() },
    })
  } else {
    try {
      vi.spyOn(window.location, 'reload').mockImplementation(() => {})
    } catch {
      const original = window.location
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...original, reload: vi.fn() },
      })
    }
  }
  reloadSpy = window.location.reload as unknown as ReturnType<typeof vi.fn>
})

afterEach(() => {
  vi.useRealTimers()
})

const getCountEl = () => document.querySelector('.rito-goodbye__count')

describe('GoodbyeRenderer', () => {
  it('renders label and initial countdown (default seconds = 10)', async () => {
    const Goodbye = await importGoodbye()
    render(<Goodbye />)

    expect(screen.getByText('Goodbye')).toBeInTheDocument()
    expect(getCountEl()?.textContent).toBe('10')
  })

  it('counts down each second via interval tick', async () => {
    const Goodbye = await importGoodbye()
    render(<Goodbye seconds={5} />)

    expect(getCountEl()?.textContent).toBe('5')

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(getCountEl()?.textContent).toBe('4')

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(getCountEl()?.textContent).toBe('2')
  })

  it('schedules a hard reload timeout and clears storage when it fires', async () => {
    const Goodbye = await importGoodbye()
    render(<Goodbye seconds={2} />)

    const firstId = (window as any)[TIMER_ID_KEY]
    // happy-dom may return a Timer object; accept number or object
    expect(['number', 'object']).toContain(typeof firstId)

    expect(sessionStorage.getItem(STORAGE_KEY)).toBeTruthy()

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(reloadSpy).toHaveBeenCalled()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
    expect((window as any)[TIMER_ID_KEY]).toBeUndefined()
  })

  it('reuses existing earlier deadline from sessionStorage (min(existing, desired))', async () => {
    const now = Date.now()
    sessionStorage.setItem(STORAGE_KEY, String(now + 15000)) // 15s

    const Goodbye = await importGoodbye()
    render(<Goodbye seconds={20} />) // desired 20s; should pick 15s

    expect(getCountEl()?.textContent).toBe('15')
  })

  it('does not schedule another hard timer if one already exists', async () => {
    const Goodbye = await importGoodbye()

    render(<Goodbye seconds={5} />)
    const firstId = (window as any)[TIMER_ID_KEY]
    expect(['number', 'object']).toContain(typeof firstId)

    render(<Goodbye seconds={3} />)
    const secondId = (window as any)[TIMER_ID_KEY]
    expect(secondId).toBe(firstId)
  })

  it('hard timeout remains active even after unmount (irreversible within session)', async () => {
    const Goodbye = await importGoodbye()
    const { unmount } = render(<Goodbye seconds={1} />)

    const idBefore = (window as any)[TIMER_ID_KEY]
    expect(['number', 'object']).toContain(typeof idBefore)

    unmount()

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    expect(reloadSpy).toHaveBeenCalled()
    expect((window as any)[TIMER_ID_KEY]).toBeUndefined()
  })

  it('SAFE_SECONDS behavior: 0 -> default 10; fractional -> 1; negative -> 1 (remount between cases)', async () => {
    const Goodbye = await importGoodbye()

    // 0 is falsy -> uses default 10
    let utils = render(<Goodbye seconds={0} />)
    expect(getCountEl()?.textContent).toBe('10')
    utils.unmount()
    sessionStorage.clear() // isolate next mount

    // fractional floors to 0 then clamp to 1
    utils = render(<Goodbye seconds={0.2} />)
    expect(getCountEl()?.textContent).toBe('1')
    utils.unmount()
    sessionStorage.clear()

    // negative floors negative then clamp to 1
    utils = render(<Goodbye seconds={-5} />)
    expect(getCountEl()?.textContent).toBe('1')
    utils.unmount()
  })
})
