import { render, screen } from '@testing-library/react'
import React from 'react'

// mock ImageRenderer to a simple div exposing props as data-attrs
vi.mock('../ImageRenderer', () => {
  const Mock: React.FC<any> = (props: any) => (
    <div
      data-testid="image-renderer"
      data-src={props.src}
      data-alt={props.alt}
      data-width={String(props.width)}
      data-height={props.height === undefined ? 'undefined' : String(props.height)}
    />
  )
  return { default: Mock }
})

const importGifRenderer = async () => {
  const mod = await import('../GifRenderer')
  return mod.default
}

beforeEach(() => {
  vi.resetModules()
})

describe('GifRenderer', () => {
  it('uses default width=300 and default alt="GIF" when not provided', async () => {
    const GifRenderer = await importGifRenderer()
    render(<GifRenderer src="https://example.com/cat.gif" />)

    const node = screen.getByTestId('image-renderer')
    expect(node.getAttribute('data-src')).toBe('https://example.com/cat.gif')
    expect(node.getAttribute('data-alt')).toBe('GIF')
    expect(node.getAttribute('data-width')).toBe('300')
    // height should pass through undefined
    expect(node.getAttribute('data-height')).toBe('undefined')
  })

  it('passes through provided width, height, and alt', async () => {
    const GifRenderer = await importGifRenderer()
    render(
      <GifRenderer
        src="/gifs/party.gif"
        alt="party time"
        width={512}
        height={256}
      />
    )

    const node = screen.getByTestId('image-renderer')
    expect(node.getAttribute('data-src')).toBe('/gifs/party.gif')
    expect(node.getAttribute('data-alt')).toBe('party time')
    expect(node.getAttribute('data-width')).toBe('512')
    expect(node.getAttribute('data-height')).toBe('256')
  })

  it('does not override an explicitly provided width', async () => {
    const GifRenderer = await importGifRenderer()
    render(<GifRenderer src="/gifs/loop.gif" width={120} />)

    const node = screen.getByTestId('image-renderer')
    expect(node.getAttribute('data-width')).toBe('120') // not 300
  })
})
