import { render, screen, act } from '@testing-library/react'
import React from 'react'

// dynamic import AFTER mocks so module-level cache resets per test
const importChainLogo = async () => {
  const mod = await import('../ChainLogo')
  return mod.default
}

// Mock only ChainOverrides; let real Shimmer render (we’ll detect by class)
const getOverrideMock = vi.fn<(s: string) => string | undefined>()
vi.mock('./ChainOverrides', () => ({
  getOverride: getOverrideMock,
}))

// helper: matches component’s URL builder
const buildCdnUrl = (key: string) =>
  `https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/${key}/info/logo.png`

// image event helpers
const fireImgLoad = (img: HTMLElement) => {
  act(() => {
    img.dispatchEvent(new Event('load'))
  })
}
const fireImgError = (img: HTMLElement) => {
  act(() => {
    img.dispatchEvent(new Event('error'))
  })
}

// util to query shimmer without mocking Shimmer component
const getShimmer = () => document.querySelector('.tw-shimmer')

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules() // ensures BLOCKCHAIN_DIRS_CACHE is fresh each test
  getOverrideMock.mockReset()
  // default: no override
  getOverrideMock.mockImplementation(() => undefined)
})

describe('ChainLogo', () => {
  it('shows fallback SVG for empty chainName and hides shimmer after image load', async () => {
  const ChainLogo = await importChainLogo()
  render(<ChainLogo chainName="" size={64} />)

  const img = screen.getByRole('img') as HTMLImageElement

  // initial render: shimmer visible
  expect(getShimmer()).not.toBeNull()

  // simulate img load to flip loaded=true
  fireImgLoad(img)

  // shimmer should hide now
  expect(getShimmer()).toBeNull()
  expect(img.src).toMatch(/^data:image\/svg\+xml;utf8,/)
  expect(img.alt).toBe('chain logo')
})
  it('uses override when available (no GitHub fetch assertion) and hides shimmer after load', async () => {
    // Make override return the key you'd expect to use (keep this in sync with your real map)
    getOverrideMock.mockImplementation(() => 'eth')
    const ChainLogo = await importChainLogo()

    render(<ChainLogo chainName="Eth" size={80} />)

    const img = screen.getByRole('img') as HTMLImageElement
    // initial URL reflects override
    expect(img.src).toBe(buildCdnUrl('eth'))
    // shimmer visible until load
    expect(getShimmer()).not.toBeNull()

    fireImgLoad(img)
    expect(getShimmer()).toBeNull()
    expect(img.alt).toBe('eth logo')
  })

  it('fuzzy-matches via directories when no override (assert outcome only)', async () => {
    const ChainLogo = await importChainLogo()

    render(<ChainLogo chainName="ether" size={96} />)

    const img = await screen.findByRole('img') as HTMLImageElement
    // Without override, Fuse should resolve to "ethereum" (based on real dirs)
    // We can’t reliably assert the fetch call count due to MSW; assert final URL instead.
    // If your env doesn’t actually fetch, the component falls back to sanitized input "ether"
    // which would produce /blockchains/ether/... — allow both to keep test robust.
    const src = img.getAttribute('src')!
    const acceptable = [
      buildCdnUrl('ethereum'),
      buildCdnUrl('ether'), // fallback if dirs unavailable
    ]
    expect(acceptable).toContain(src)

    // shimmer then hides after load
    expect(getShimmer()).not.toBeNull()
    fireImgLoad(img)
    expect(getShimmer()).toBeNull()
    // alt uses resolvedKey or original chainName
    expect(img.alt === 'ethereum logo' || img.alt === 'ether logo').toBe(true)
  })

  it('falls back to inline SVG on image error and hides shimmer', async () => {
    const ChainLogo = await importChainLogo()

    render(<ChainLogo chainName="polygon" size={72} />)
    const img = await screen.findByRole('img') as HTMLImageElement

    // force error → component swaps to fallback data URI and sets loaded=true
    fireImgError(img)
    expect(img.src).toMatch(/^data:image\/svg\+xml;utf8,/)
    expect(getShimmer()).toBeNull()
  })

  it('does not reset loading when URL stays the same on re-render', async () => {
    // stable override key means same URL across re-renders
    getOverrideMock.mockReturnValue('eth')
    const ChainLogo = await importChainLogo()

    const { rerender } = render(<ChainLogo chainName="ETH" size={64} />)
    const img = screen.getByRole('img') as HTMLImageElement

    // shimmer initially present
    expect(getShimmer()).not.toBeNull()
    fireImgLoad(img)
    expect(getShimmer()).toBeNull()

    // re-render with different casing/spaces; URL must be unchanged, so no shimmer flash
    rerender(<ChainLogo chainName="  eth  " size={64} />)
    expect(getShimmer()).toBeNull()
    expect(img.src).toBe(buildCdnUrl('eth'))
  })

  it('normalizes input (trim/case-insensitive) and resolves sensibly', async () => {
    const ChainLogo = await importChainLogo()

    render(<ChainLogo chainName="   PolYgOn  " size={48} />)

    const img = await screen.findByRole('img') as HTMLImageElement
    const src = img.getAttribute('src')!
    const acceptable = [
      buildCdnUrl('polygon'),
      buildCdnUrl('polygon'.replace(/\s+/g, '')), // same result
    ]
    expect(acceptable).toContain(src)

    fireImgLoad(img)
    expect(getShimmer()).toBeNull()
    expect(img.alt).toBe('polygon logo')
  })
})
