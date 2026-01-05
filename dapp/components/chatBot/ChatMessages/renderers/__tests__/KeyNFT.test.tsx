// dapp/components/chatBot/ChatMessages/renderers/__tests__/KeyNFT.test.tsx
import { render, screen } from '@testing-library/react'
import React from 'react'
import KeyNFT from '../KeyNFT'

// narrow query helper for SVG children
const q = (root: Element, sel: string) =>
  root.querySelector(sel) as (SVGElement | null)

describe('KeyNFT', () => {
  it('renders an accessible SVG with defaults', () => {
    const { container } = render(<KeyNFT />)

    // accessibility check
    expect(screen.getByRole('img', { name: 'Key NFT' })).toBeInTheDocument()

    // work with the actual <svg> element via querySelector (Element -> SVGSVGElement)
    const svg = container.querySelector('svg') as SVGSVGElement
    expect(svg).toBeTruthy()
    expect(svg.getAttribute('viewBox')).toBe('0 0 200 100')
    expect(svg.getAttribute('width')).toBe('200')
    expect(svg.getAttribute('height')).toBe('100')

    // background rect
    const bg = q(svg, 'rect[x="0"][y="0"]')
    expect(bg).toBeTruthy()
    expect(bg!.getAttribute('width')).toBe('200')
    expect(bg!.getAttribute('height')).toBe('100')
    expect(bg!.getAttribute('fill')).toBe('#222') // default bgColor

    // circular head
    const circle = q(svg, 'circle[cx="60"][cy="50"][r="20"]')
    expect(circle).toBeTruthy()
    expect(circle!.getAttribute('fill')).toBe('none')
    expect(circle!.getAttribute('stroke')).toBe('#ffd700')
    expect(circle!.getAttribute('stroke-width') || circle!.getAttribute('strokeWidth')).toBe('10')

    // key shaft rect
    const shaft = q(svg, 'rect[x="80"][y="45"][width="100"][height="10"]')
    expect(shaft).toBeTruthy()
    expect(shaft!.getAttribute('fill')).toBe('#ffd700')

    // two teeth paths
    const paths = svg.querySelectorAll('path')
    expect(paths.length).toBe(2)
    paths.forEach(p => expect(p.getAttribute('fill')).toBe('#ffd700'))
  })

  it('respects custom colors and string dimensions', () => {
    const { container } = render(
      <KeyNFT bgColor="#000" keyColor="#00ff00" width="50%" height="2rem" />
    )

    // presence check for a11y
    expect(screen.getByRole('img', { name: 'Key NFT' })).toBeInTheDocument()

    const svg = container.querySelector('svg') as SVGSVGElement
    expect(svg).toBeTruthy()
    expect(svg.getAttribute('width')).toBe('50%')
    expect(svg.getAttribute('height')).toBe('2rem')

    const bg = q(svg, 'rect[x="0"][y="0"]')
    expect(bg!.getAttribute('fill')).toBe('#000')

    const circle = q(svg, 'circle[cx="60"][cy="50"][r="20"]')
    expect(circle!.getAttribute('stroke')).toBe('#00ff00')

    const shaft = q(svg, 'rect[x="80"][y="45"][width="100"][height="10"]')
    expect(shaft!.getAttribute('fill')).toBe('#00ff00')

    const paths = svg.querySelectorAll('path')
    paths.forEach(p => expect(p.getAttribute('fill')).toBe('#00ff00'))
  })

  it('accepts numeric dimensions', () => {
    const { container } = render(<KeyNFT width={320} height={160} />)

    expect(screen.getByRole('img', { name: 'Key NFT' })).toBeInTheDocument()

    const svg = container.querySelector('svg') as SVGSVGElement
    expect(svg).toBeTruthy()
    expect(svg.getAttribute('width')).toBe('320')
    expect(svg.getAttribute('height')).toBe('160')
  })
})
