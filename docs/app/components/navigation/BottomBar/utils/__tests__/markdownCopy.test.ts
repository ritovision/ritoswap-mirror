import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { copyPageAsMarkdown } from '@/app/components/navigation/BottomBar/utils/markdownCopy'

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const originalHref = window.location.href

describe('copyPageAsMarkdown', () => {
  let writeTextMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    writeTextMock = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextMock
      }
    })

    // We set base URL in vitest.config to https://ritoswap.io
    // so this stays same-origin and avoids SecurityError.
    window.history.replaceState({}, '', '/docs/getting-started')

    document.title = 'Getting Started'
    document.body.innerHTML = `
      <main>
        <h1>Getting Started</h1>
        <p>Welcome to <strong>Ritoswap</strong> docs.</p>
        <div>
          <h2>Install</h2>
          <p>Run <code>pnpm install</code> to begin.</p>
          <script>console.log('ignore me')</script>
        </div>
        <footer>Footer</footer>
      </main>
    `
  })

  afterEach(() => {
    document.body.innerHTML = ''

    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', originalClipboard)
    } else {
      Reflect.deleteProperty(navigator, 'clipboard')
    }

    window.history.replaceState({}, '', originalHref)

    vi.restoreAllMocks()
  })

  it('writes converted markdown to clipboard', async () => {
    await copyPageAsMarkdown()

    expect(writeTextMock).toHaveBeenCalledTimes(1)
    const [markdown] = writeTextMock.mock.calls[0]

    expect(markdown).toContain('# Getting Started')
    expect(markdown).toContain('Source: https://ritoswap.io/docs/getting-started')
    // The simple HTML→markdown converter may collapse spaces around inline tags
    // (e.g. <strong>). Accept an optional space before 'docs.'
    expect(markdown).toMatch(/\*\*Ritoswap\*\*\s?docs\./)
    // Accept either block code fence or inline code formatting for pnpm command
    expect(markdown).toMatch(/`pnpm install`|```[\s\S]*pnpm install[\s\S]*```/)
    expect(markdown).not.toContain('<script>')
  })

  it('surfaces clipboard errors', async () => {
    const error = new Error('no clipboard access')
    writeTextMock.mockRejectedValueOnce(error)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(copyPageAsMarkdown()).rejects.toThrow('no clipboard access')
    expect(consoleSpy).toHaveBeenCalledWith('Failed to copy page as markdown:', error)
  })
})
