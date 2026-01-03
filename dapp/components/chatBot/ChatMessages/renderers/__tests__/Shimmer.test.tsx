import { render } from '@testing-library/react'
import React from 'react'
import Shimmer from '../Shimmer'

const getStyleTagText = (container: HTMLElement) => {
  const styles = Array.from(container.querySelectorAll('style'))
  return styles.map(s => s.textContent || '').join('\n')
}

describe('Shimmer', () => {
  it('renders span.tw-shimmer with default radius and default duration (1200ms)', () => {
    const { container } = render(<Shimmer width={64} height={32} />)

    const span = container.querySelector('span.tw-shimmer') as HTMLSpanElement
    expect(span).toBeTruthy()

    // inline styles: numeric -> px
    expect(span.style.width).toBe('64px')
    expect(span.style.height).toBe('32px')
    expect(span.style.borderRadius).toBe('8px') // default radius

    // aria-hidden should be "true"
    expect(span.getAttribute('aria-hidden')).toBe('true')

    // style tag should include animation with 1200ms
    const css = getStyleTagText(container)
    expect(css).toMatch(/@keyframes shimmerMove/)
    expect(css).toMatch(/animation:\s*shimmerMove\s*1200ms\s*linear\s*infinite/)
  })

  it('respects custom radius and duration', () => {
    const { container } = render(<Shimmer width={100} height={50} radius={12} duration={600} />)

    const span = container.querySelector('span.tw-shimmer') as HTMLSpanElement
    expect(span).toBeTruthy()
    expect(span.style.width).toBe('100px')
    expect(span.style.height).toBe('50px')
    expect(span.style.borderRadius).toBe('12px')

    const css = getStyleTagText(container)
    expect(css).toMatch(/animation:\s*shimmerMove\s*600ms\s*linear\s*infinite/)
  })
})
