import { render, screen, act } from '@testing-library/react'
import React from 'react'

// --- mocks ---

// CSS module mock
vi.mock('../ChatMessages.module.css', () => ({
  default: { imageContainer: 'imageContainer', chatImage: 'chatImage' },
}))

// simple in-memory mock store + helpers
type StoreEntry = { dataUrl?: string; width?: number; height?: number; alt?: string }
let mockStore = new Map<string, StoreEntry>()

const isStoreImageUri = (uri: string) => uri.startsWith('store://')
const nameFromStoreUri = (uri: string) => uri.replace(/^store:\/\//, '')

// mock hook invokes the selector with an object that has get(name)
vi.mock('@store/toolImageStore', () => ({
  isStoreImageUri: (uri: string) => isStoreImageUri(uri),
  nameFromStoreUri: (uri: string) => nameFromStoreUri(uri),
  useLocalImageStore: (selector: (s: { get: (k: string) => StoreEntry | undefined }) => any) =>
    selector({ get: (k: string) => mockStore.get(k) }),
}))

// dynamic import after mocks so module state is fresh per test
const importImageRenderer = async () => {
  const mod = await import('../ImageRenderer')
  return mod.default
}

// helpers
const getShimmer = () => document.querySelector('.tw-shimmer')
const fireImgLoad = (img: HTMLElement) => {
  act(() => img.dispatchEvent(new Event('load')))
}
const fireImgError = (img: HTMLElement) => {
  act(() => img.dispatchEvent(new Event('error')))
}

beforeEach(() => {
  vi.resetModules()
  mockStore = new Map()
})

describe('ImageRenderer', () => {
  it('http: shows shimmer until image loads, then hides; default alt is "image"', async () => {
    const ImageRenderer = await importImageRenderer()
    render(<ImageRenderer src="https://example.com/pic.png" width={200} height={100} />)

    // shimmer visible initially
    expect(getShimmer()).not.toBeNull()

    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('https://example.com/pic.png')
    expect(img.getAttribute('alt')).toBe('image')

    // simulate load → shimmer hides
    fireImgLoad(img)
    expect(getShimmer()).toBeNull()
    // opacity should be 1 after load
    expect(img.style.opacity).toBe('1')
  })

  it('http: on error falls back to inline SVG and sets alt to "Image not found"', async () => {
    const ImageRenderer = await importImageRenderer()
    render(<ImageRenderer src="https://example.com/404.png" />)

    const img = screen.getByRole('img') as HTMLImageElement
    // still a shimmer until load/error resolves
    expect(getShimmer()).not.toBeNull()

    fireImgError(img)

    expect(img.getAttribute('src')).toMatch(/^data:image\/svg\+xml;base64,/)
    expect(img.getAttribute('alt')).toBe('Image not found')
    // shimmer hidden after error
    expect(getShimmer()).toBeNull()
  })

  it('store:// not hydrated: only shimmer, no <img>', async () => {
    const ImageRenderer = await importImageRenderer()
    render(<ImageRenderer src="store://avatar" />)

    // since the store entry has no dataUrl yet, the component renders only a shimmer placeholder
    expect(getShimmer()).not.toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('store:// after hydration: renders dataUrl, width/height from store, and store alt if no prop', async () => {
    const ImageRenderer = await importImageRenderer()

    // initial: no data for "avatar"
    const utils = render(<ImageRenderer src="store://avatar" />)
    expect(screen.queryByRole('img')).toBeNull()

    // hydrate the store
    mockStore.set('avatar', {
      dataUrl: 'data:image/png;base64,AAA',
      width: 320,
      height: 180,
      alt: 'User avatar',
    })

    // re-render to pick up updated selector result
    utils.rerender(<ImageRenderer src="store://avatar" />)

    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('data:image/png;base64,AAA')
    // default alt comes from store entry when no alt prop is provided
    expect(img.getAttribute('alt')).toBe('User avatar')
    expect(img.getAttribute('width')).toBe('320')
    expect(img.getAttribute('height')).toBe('180')

    // simulate load → shimmer hides
    expect(getShimmer()).not.toBeNull()
    fireImgLoad(img)
    expect(getShimmer()).toBeNull()
  })

  it('store:// alt prop overrides store alt', async () => {
    const ImageRenderer = await importImageRenderer()

    mockStore.set('logo', {
      dataUrl: 'data:image/png;base64,BBB',
      width: 100,
      height: 100,
      alt: 'From store',
    })

    render(<ImageRenderer src="store://logo" alt="From prop" />)
    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.getAttribute('alt')).toBe('From prop')
  })

  it('resets loading when resolvedSrc changes (shimmer flashes again)', async () => {
    const ImageRenderer = await importImageRenderer()

    const { rerender } = render(<ImageRenderer src="https://example.com/a.png" />)
    const img = screen.getByRole('img') as HTMLImageElement

    // initial shimmer
    expect(getShimmer()).not.toBeNull()
    fireImgLoad(img)
    expect(getShimmer()).toBeNull()

    // change src -> should reset loading and show shimmer again
    rerender(<ImageRenderer src="https://example.com/b.png" />)
    expect(getShimmer()).not.toBeNull()
    // then load hides it
    const img2 = screen.getByRole('img') as HTMLImageElement
    fireImgLoad(img2)
    expect(getShimmer()).toBeNull()
  })
})
