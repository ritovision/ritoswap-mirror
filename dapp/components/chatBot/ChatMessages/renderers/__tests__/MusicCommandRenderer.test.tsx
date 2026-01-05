// dapp/components/chatBot/ChatMessages/renderers/__tests__/MusicCommandRenderer.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ---- Mocks ----

// CSS module for the pill — just needs to exist
vi.mock('../MusicCommandRenderer.module.css', () => ({
  default: {
    pill: 'pill',
    icon: 'icon',
    lines: 'lines',
    top: 'top',
    bottom: 'bottom',
  },
}))

// Mutable mock we can tweak per-test
let mockMusic: {
  loadSong: ReturnType<typeof vi.fn>
  seek: ReturnType<typeof vi.fn>
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
  toggle: ReturnType<typeof vi.fn>
  currentSongName: string | null
  isPlaying: boolean
}

// IMPORTANT: from __tests__/ to MusicPlayer/MusicProvider is THREE levels up
// renderers/__tests__/ -> renderers -> ChatMessages -> chatBot -> MusicPlayer
vi.mock('../../../MusicPlayer/MusicProvider', () => ({
  useMusic: () => mockMusic,
}))

const importComp = async () => {
  const mod = await import('../MusicCommandRenderer')
  return mod.default
}

beforeEach(() => {
  vi.resetModules()

  mockMusic = {
    loadSong: vi.fn(async () => {}),
    seek: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    toggle: vi.fn(),
    currentSongName: 'Current Song',
    isPlaying: false,
  }

  // Ensure there's a "music-bar" element to scroll to
  let el = document.getElementById('music-bar') as any
  if (!el) {
    el = document.createElement('div')
    el.id = 'music-bar'
    document.body.appendChild(el)
  }
  // add spies on the element instance
  ;(el as any).scrollIntoView = vi.fn()
  ;(el as any).focus = vi.fn()
})

const getMusicBar = () => document.getElementById('music-bar') as any

describe('MusicCommandRenderer', () => {
  it('combo: song + timeline → loadSong(autoplay:false) then seek(autoplay:true); shows "Loading at mm:ss"', async () => {
    const MusicCommandRenderer = await importComp()

    render(
      <MusicCommandRenderer
        seg={{ song: 'New Track', timeline: 42, ext: 'mp3' } as any}
      />
    )

    // loadSong awaited inside effect, then seek called — wait for it
    await waitFor(() => {
      expect(mockMusic.loadSong).toHaveBeenCalledTimes(1)
      expect(mockMusic.loadSong).toHaveBeenCalledWith('New Track', {
        ext: 'mp3',
        autoplay: false,
      })
      expect(mockMusic.seek).toHaveBeenCalledTimes(1)
      expect(mockMusic.seek).toHaveBeenCalledWith(42, { autoplay: true })
    })

    // UI lines + icon (play triangle path present)
    expect(screen.getByText('Loading at 0:42')).toBeInTheDocument()
    expect(screen.getByText('New Track')).toBeInTheDocument()
    expect(document.querySelector('svg path[d="M6 3 L21 12 L6 21 Z"]')).toBeTruthy()
  })

  it('just song (no timeline): loadSong with autoplay default true; shows "Now Playing"', async () => {
    const MusicCommandRenderer = await importComp()

    render(<MusicCommandRenderer seg={{ song: 'Solo' } as any} />)

    // loadSong happens sync in this branch (no seek), but let’s be consistent
    await waitFor(() => {
      expect(mockMusic.loadSong).toHaveBeenCalledTimes(1)
      expect(mockMusic.loadSong).toHaveBeenCalledWith('Solo', {
        ext: undefined,
        autoplay: true,
      })
      expect(mockMusic.seek).not.toHaveBeenCalled()
    })
    expect(screen.getByText('Now Playing')).toBeInTheDocument()
    expect(screen.getByText('Solo')).toBeInTheDocument()
  })

  it('just timeline: seek with autoplay true; shows "Skipping to mm:ss" and uses current song name', async () => {
    const MusicCommandRenderer = await importComp()

    mockMusic.currentSongName = 'Current Song'
    render(<MusicCommandRenderer seg={{ timeline: 75 } as any} />)

    await waitFor(() => {
      expect(mockMusic.seek).toHaveBeenCalledTimes(1)
      expect(mockMusic.seek).toHaveBeenCalledWith(75, { autoplay: true })
    })
    expect(screen.getByText('Skipping to 1:15')).toBeInTheDocument()
    expect(screen.getByText('Current Song')).toBeInTheDocument()
  })

  it('explicit actions run independently: pause shows pause icon & label', async () => {
    const MusicCommandRenderer = await importComp()

    mockMusic.currentSongName = 'Track X'
    mockMusic.isPlaying = true
    render(<MusicCommandRenderer seg={{ action: 'pause' } as any} />)

    expect(mockMusic.pause).toHaveBeenCalledTimes(1)
    // icon is pause: two rects
    expect(document.querySelector('svg rect[x="4"][y="2"]')).toBeTruthy()
    expect(screen.getByText('Pausing')).toBeInTheDocument()
    expect(screen.getByText('Track X')).toBeInTheDocument()
  })

  it('toggle action is called; icon depends on isPlaying (true -> pause icon)', async () => {
    const MusicCommandRenderer = await importComp()

    mockMusic.isPlaying = true
    render(<MusicCommandRenderer seg={{ action: 'toggle' } as any} />)

    expect(mockMusic.toggle).toHaveBeenCalledTimes(1)
    // pause icon rendered (rects present)
    expect(document.querySelector('svg rect[x="4"][y="2"]')).toBeTruthy()
  })

  it('clicking or pressing Enter/Space scrolls and focuses #music-bar', async () => {
    const MusicCommandRenderer = await importComp()

    const bar = getMusicBar()
    const scrollSpy = bar.scrollIntoView as ReturnType<typeof vi.fn>
    const focusSpy = bar.focus as ReturnType<typeof vi.fn>

    const { getByRole } = render(
      <MusicCommandRenderer seg={{ song: 'Scroll Song' } as any} />
    )
    const pill = getByRole('button')

    // Click triggers scroll + focus
    fireEvent.click(pill)
    expect(scrollSpy).toHaveBeenCalled()
    expect(focusSpy).toHaveBeenCalled()

    scrollSpy.mockClear()
    focusSpy.mockClear()

    // Enter key
    fireEvent.keyDown(pill, { key: 'Enter' })
    expect(scrollSpy).toHaveBeenCalled()
    expect(focusSpy).toHaveBeenCalled()

    scrollSpy.mockClear()
    focusSpy.mockClear()

    // Space key
    fireEvent.keyDown(pill, { key: ' ' })
    expect(scrollSpy).toHaveBeenCalled()
    expect(focusSpy).toHaveBeenCalled()
  })

  it('effect runs only once on mount (guarded by ref)', async () => {
    const MusicCommandRenderer = await importComp()

    const { rerender } = render(
      <MusicCommandRenderer seg={{ song: 'A', timeline: 10 } as any} />
    )

    // Wait for first run to complete (load + seek)
    await waitFor(() => {
      expect(mockMusic.loadSong).toHaveBeenCalledTimes(1)
      expect(mockMusic.seek).toHaveBeenCalledTimes(1)
    })

    // rerender with same seg shouldn't trigger again
    rerender(<MusicCommandRenderer seg={{ song: 'A', timeline: 10 } as any} />)

    // Still only once
    await waitFor(() => {
      expect(mockMusic.loadSong).toHaveBeenCalledTimes(1)
      expect(mockMusic.seek).toHaveBeenCalledTimes(1)
    })
  })

  it('a11y: pill has proper role, tabIndex and aria-label including both lines', async () => {
    const MusicCommandRenderer = await importComp()

    render(<MusicCommandRenderer seg={{ timeline: 5 } as any} />)

    const pill = screen.getByRole('button')
    expect(pill).toBeInTheDocument()
    expect(pill).toHaveAttribute('tabIndex', '0')
    expect(pill).toHaveAttribute('aria-label', expect.stringContaining('Skipping to 0:05'))
    expect(pill).toHaveAttribute('aria-label', expect.stringContaining('Current Song'))
  })
})
