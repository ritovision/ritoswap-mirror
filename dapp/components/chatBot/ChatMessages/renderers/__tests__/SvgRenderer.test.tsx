// dapp/components/chatBot/ChatMessages/renderers/__tests__/SvgRenderer.test.tsx
import { render, screen } from '@testing-library/react'
import React from 'react'

// mock CSS module (note the path from __tests__)
vi.mock('../../ChatMessages.module.css', () => ({
  default: { svgContainer: 'svgContainer' },
}))

// controllable mocks (correct relative path for utils)
const prepareSvgMock = vi.fn((s: string) => `PREP:${s}`)
vi.mock('../../utils/svgHelpers', () => ({
  prepareSvg: prepareSvgMock,
}))

// typed sanitize mock to keep TS happy
const sanitizeMock = vi.fn<(input: string, options?: unknown) => string>(
  (s: string) => s
)
vi.mock('dompurify', () => ({
  default: {
    sanitize: (input: string, options?: unknown) => sanitizeMock(input, options),
  },
}))

const importSvgRenderer = async () => {
  const mod = await import('../SvgRenderer')
  return mod.default
}

beforeEach(() => {
  vi.resetModules()
  prepareSvgMock.mockClear()
  sanitizeMock.mockClear()
})

describe('SvgRenderer', () => {
  it('sanitizes SVG via DOMPurify with SVG profile and renders the result', async () => {
    const SvgRenderer = await importSvgRenderer()

    // Make sanitize return a known clean SVG
    sanitizeMock.mockImplementation((_input: string) => `<svg id="clean" viewBox="0 0 1 1"></svg>`)

    const input = `<svg id="raw"><script>alert(1)</script></svg>`
    const { container } = render(<SvgRenderer svgString={input} />)

    // prepareSvg applied first
    expect(prepareSvgMock).toHaveBeenCalledWith(input)

    // DOMPurify invoked with prepared string & options
    expect(sanitizeMock).toHaveBeenCalledTimes(1)
    const [sanInput, options] = sanitizeMock.mock.calls[0] as [string, any]
    expect(sanInput).toBe(`PREP:${input}`)

    // spot-check key options without over-specifying
    expect(options?.USE_PROFILES?.svg).toBe(true)
    expect(options?.ALLOW_DATA_ATTR).toBe(false)
    expect(Array.isArray(options?.ADD_TAGS)).toBe(true)
    expect(Array.isArray(options?.ADD_ATTR)).toBe(true)

    // sanitized content is inserted
    expect(container.querySelector('svg#clean')).toBeTruthy()

    // a11y wrapper is present
    const wrapper = screen.getByRole('img', { name: 'SVG Image' })
    expect(wrapper).toBeInTheDocument()
  })

  it('renders "Invalid SVG" placeholder when sanitization returns empty/whitespace', async () => {
    const SvgRenderer = await importSvgRenderer()

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    sanitizeMock.mockImplementation(() => '   ') // whitespace ⇒ empty result

    render(<SvgRenderer svgString="<svg />" />)
    expect(screen.getByText(/Invalid SVG/i)).toBeInTheDocument()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('renders "Error loading SVG" placeholder when sanitize throws', async () => {
    const SvgRenderer = await importSvgRenderer()

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    sanitizeMock.mockImplementation(() => {
      throw new Error('boom')
    })

    render(<SvgRenderer svgString="<svg />" />)
    expect(screen.getByText(/Error loading SVG/i)).toBeInTheDocument()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('keeps accessible wrapper and injects sanitized SVG', async () => {
    const SvgRenderer = await importSvgRenderer()

    sanitizeMock.mockImplementation((_i: string) => `<svg id="ok"></svg>`)
    render(<SvgRenderer svgString="<svg />" />)

    const wrapper = screen.getByRole('img', { name: 'SVG Image' })
    expect(wrapper).toBeInTheDocument()
    expect(wrapper.querySelector('svg#ok')).toBeTruthy()
  })
})
