// app/lib/jsonld/getHomepageJsonLd.test.ts
import fs from 'fs'
import path from 'path'
import { getHomepageJsonLd } from './getHomepageJsonLd'

describe('getHomepageJsonLd', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy  = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns [] and warns if directory does not exist', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false)

    const result = getHomepageJsonLd()
    expect(result).toEqual([])
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Homepage JSON-LD directory not found')
    )
  })

  it('parses valid .txt JSON, skips empty and invalid files, and logs warnings/errors', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)

    vi.spyOn(fs, 'readdirSync').mockReturnValue([
      'good.txt',
      'empty.txt',
      'bad.txt',
      'ignore.md',
    ] as any)

    const readSpy = vi.spyOn(fs, 'readFileSync')
    ;(readSpy as any).mockImplementation((filePath: string) => {
      if (filePath.endsWith(`${path.sep}good.txt`)) return ' { "hello": "world" } '
      if (filePath.endsWith(`${path.sep}empty.txt`)) return '   '
      if (filePath.endsWith(`${path.sep}bad.txt`)) return '{ this is : bad json }'
      return ''
    })

    const result = getHomepageJsonLd()
    expect(result).toEqual([{ hello: 'world' }])

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Skipping empty file: empty.txt')
    )
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid JSON in homepage JSON-LD file: bad.txt'),
      expect.any(Error)
    )
  })

  it('handles readdirSync throwing an error gracefully', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)

    vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
      throw new Error('oops')
    })

    const result = getHomepageJsonLd()
    expect(result).toEqual([])
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error reading homepage JSON-LD files:'),
      expect.any(Error)
    )
  })
})
