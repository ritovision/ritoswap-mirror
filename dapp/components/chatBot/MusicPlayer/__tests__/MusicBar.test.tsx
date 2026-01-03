// dapp/components/chatBot/MusicPlayer/__tests__/MusicBar.test.tsx
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import MusicBar from './../MusicBar';
import { MusicProvider, useMusic } from './../MusicProvider';

// NOTE: we avoid mocking the CSS file; your Vitest config already sets test.css=false.
// If you still see CSS import issues, you can add a mock like:
// vi.mock('./../MusicBar.module.css', () => ({ default: { wrapper:'w', hidden:'h', bar:'b', time:'t', song:'s', icon:'i' } }));

let lastCtx: any;
let MOCK_DURATION = 10;

class FakeAudioBuffer { constructor(public duration: number) {} }
class FakeGainNode { gain = { value: 1 }; connect = vi.fn(); disconnect = vi.fn(); }
class FakeBufferSource {
  buffer: FakeAudioBuffer | null = null;
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn((_when: number, offset: number) => {
    const remaining = Math.max(0, (this.buffer?.duration ?? 0) - offset);
    setTimeout(() => this.onended?.(), remaining * 1000);
  });
  stop = vi.fn();
}
class FakeAudioContext {
  state: 'suspended' | 'running' = 'suspended';
  destination: object = {};
  private _currentTime = 0;
  constructor() { lastCtx = this; }
  get currentTime() { return this._currentTime; }
  advanceBy(sec: number) { this._currentTime += sec; }
  resume = vi.fn(async () => { this.state = 'running'; });
  createGain() { return new FakeGainNode(); }
  createBufferSource() { return new FakeBufferSource(); }
  async decodeAudioData(_ab: ArrayBuffer) { return new FakeAudioBuffer(MOCK_DURATION); }
}

function Harness() {
  const music = useMusic();
  return (
    <div>
      <button
        onClick={async () => {
          music.unlock();
          await music.loadSong('demo', { autoplay: false });
        }}
      >
        load
      </button>
      <MusicBar />
    </div>
  );
}

describe('MusicBar', () => {
  const originalAudioContext = (globalThis as any).AudioContext;
  const originalWebkitAudioContext = (globalThis as any).webkitAudioContext;
  const originalFetch = global.fetch;

  beforeEach(() => {
    // IMPORTANT: start with REAL timers so findBy* can poll.
    vi.useRealTimers();
    (globalThis as any).AudioContext = FakeAudioContext as any;
    (globalThis as any).webkitAudioContext = undefined;
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(8),
    })) as any;
  });

  afterEach(() => {
    (globalThis as any).AudioContext = originalAudioContext;
    (globalThis as any).webkitAudioContext = originalWebkitAudioContext;
    global.fetch = originalFetch!;
    MOCK_DURATION = 10;
  });

  it('renders hidden placeholder when no song is loaded', () => {
    render(
      <MusicProvider>
        <MusicBar />
      </MusicProvider>
    );
    expect(document.getElementById('music-bar')).toBeNull();
  });

  it('shows Play label & time after load, toggles on click and with keyboard', async () => {
    render(
      <MusicProvider>
        <Harness />
      </MusicProvider>
    );

    // Click the helper button to unlock + load
    await act(async () => {
      fireEvent.click(screen.getByText('load'));
    });

    // With REAL timers, the async load settles and the bar appears
    const barBtn = await screen.findByRole('button', { name: /Play demo/i });
    expect(barBtn).toBeInTheDocument();
    expect(barBtn).toHaveAttribute('aria-pressed', 'false');

    // Click toggles to playing
    act(() => {
      fireEvent.click(barBtn);
    });
    expect(barBtn).toHaveAttribute('aria-pressed', 'true');
    expect(barBtn.getAttribute('aria-label')).toMatch(/^Pause demo/);

    // Keyboard Enter toggles back to paused
    act(() => {
      fireEvent.keyDown(barBtn, { key: 'Enter' });
    });
    expect(barBtn).toHaveAttribute('aria-pressed', 'false');
    expect(barBtn.getAttribute('aria-label')).toMatch(/^Play demo/);

    // Switch to FAKE timers only now so the provider’s next startTicker uses them.
    vi.useFakeTimers();

    // Space toggles to playing again (this creates the setInterval under fake timers)
    act(() => {
      fireEvent.keyDown(barBtn, { key: ' ' });
    });
    expect(barBtn).toHaveAttribute('aria-pressed', 'true');

    // Advance both the AudioContext clock and the ticker
    act(() => {
      (lastCtx as any).advanceBy(1);
      vi.advanceTimersByTime(1000);
    });

    // aria-label includes "m:ss/m:ss" at the end; just assert it has a time pattern
    expect(barBtn.getAttribute('aria-label')).toMatch(/\/\d+:\d{2}$/);
  });
});
