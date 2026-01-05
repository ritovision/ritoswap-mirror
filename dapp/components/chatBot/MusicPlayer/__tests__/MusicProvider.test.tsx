// dapp/components/chatBot/MusicPlayer/MusicProvider.test.tsx
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { MusicProvider, useMusic } from './../MusicProvider';

type AnyFn = (...args: any[]) => any;

let lastCtx: any;
let MOCK_DURATION = 10;

class FakeAudioBuffer {
  duration: number;
  constructor(duration: number) {
    this.duration = duration;
  }
}

class FakeGainNode {
  gain = { value: 1 };
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeBufferSource {
  buffer: FakeAudioBuffer | null = null;
  onended: (() => void) | null = null;
  _connected = false;
  _started = false;

  connect = vi.fn();
  disconnect = vi.fn();

  start = vi.fn((when: number, offset: number) => {
    this._started = true;
    // schedule a natural end when the remaining time elapses
    const remaining = Math.max(0, (this.buffer?.duration ?? 0) - offset);
    // Let timers drive this so tests can vi.advanceTimersByTime
    setTimeout(() => this.onended?.(), remaining * 1000);
  });

  stop = vi.fn(() => {
    // In real impl, onended may also fire, but provider nulls handler before stop()
    // so doing nothing here is fine for our tests.
  });
}

class FakeAudioContext {
  state: 'suspended' | 'running' = 'suspended';
  destination: object = {};
  private _currentTime = 0;

  constructor() {
    lastCtx = this;
  }

  get currentTime() {
    return this._currentTime;
  }

  advanceBy(seconds: number) {
    this._currentTime += seconds;
  }

  resume = vi.fn(async () => {
    this.state = 'running';
  });

  createGain(): any {
    return new FakeGainNode();
  }

  createBufferSource(): any {
    return new FakeBufferSource();
  }

  async decodeAudioData(_ab: ArrayBuffer): Promise<FakeAudioBuffer> {
    return new FakeAudioBuffer(MOCK_DURATION);
  }
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <MusicProvider>{children}</MusicProvider>;
}

describe('MusicProvider', () => {
  const originalAudioContext = (globalThis as any).AudioContext;
  const originalWebkitAudioContext = (globalThis as any).webkitAudioContext;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as any).AudioContext = FakeAudioContext as any;
    (globalThis as any).webkitAudioContext = undefined;

    global.fetch = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) => {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new ArrayBuffer(8),
      } as any;
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    (globalThis as any).AudioContext = originalAudioContext;
    (globalThis as any).webkitAudioContext = originalWebkitAudioContext;
    global.fetch = originalFetch!;
    MOCK_DURATION = 10;
  });

  it('exposes default state before unlock', () => {
    const { result } = renderHook(() => useMusic(), { wrapper });
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentSongName).toBeNull();
    expect(result.current.duration).toBe(0);
    expect(result.current.currentTime).toBe(0);
  });

  it('unlock resumes suspended context and flips isUnlocked', () => {
    const { result } = renderHook(() => useMusic(), { wrapper });

    act(() => {
      result.current.unlock();
    });

    expect(result.current.isUnlocked).toBe(true);
    expect(lastCtx.state).toBe('running');
  });

  it('loadSong (local) sets name, duration and does not autoplay by default', async () => {
    const { result } = renderHook(() => useMusic(), { wrapper });

    await act(async () => {
      await result.current.loadSong('test'); // default ext mp3, autoplay=false
    });

    expect(global.fetch).toHaveBeenCalledWith('/audio/test.mp3', { mode: 'cors' });
    expect(result.current.currentSongName).toBe('test');
    expect(result.current.duration).toBe(MOCK_DURATION);
    expect(result.current.isPlaying).toBe(false);
  });

  it('play starts playback and ticker updates currentTime', async () => {
    const { result } = renderHook(() => useMusic(), { wrapper });

    await act(async () => {
      await result.current.loadSong('test', { autoplay: false });
    });

    act(() => {
      result.current.play();
    });
    expect(result.current.isPlaying).toBe(true);
    // advance "audio clock" and ticker
    act(() => {
      (lastCtx as any).advanceBy(0.5);
      vi.advanceTimersByTime(250);
      (lastCtx as any).advanceBy(0.5);
      vi.advanceTimersByTime(250);
    });
    expect(result.current.currentTime).toBeGreaterThanOrEqual(0.9);
  });

  it('pause stops playback and retains position; toggle resumes from offset', async () => {
    const { result } = renderHook(() => useMusic(), { wrapper });

    await act(async () => {
      await result.current.loadSong('test');
    });

    act(() => {
      result.current.play();
    });

    act(() => {
      (lastCtx as any).advanceBy(2);
      vi.advanceTimersByTime(2000);
    });

    act(() => {
      result.current.pause();
    });

    const pausedTime = result.current.currentTime;
    expect(result.current.isPlaying).toBe(false);
    expect(pausedTime).toBeGreaterThanOrEqual(1.9);

    act(() => {
      result.current.toggle(); // play
    });

    // after resume, time should continue from pause offset
    act(() => {
      (lastCtx as any).advanceBy(1);
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.isPlaying).toBe(true);
    expect(result.current.currentTime).toBeGreaterThanOrEqual(pausedTime + 0.9);
  });

  it('seek defaults to autoplay; seek with autoplay:false does not play', async () => {
    const { result } = renderHook(() => useMusic(), { wrapper });

    await act(async () => {
      await result.current.loadSong('test', { autoplay: false });
    });

    act(() => {
      result.current.seek(8); // autoplay default true
    });
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.currentTime).toBeCloseTo(8, 2);

    act(() => {
      result.current.seek(3, { autoplay: false });
    });
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentTime).toBeCloseTo(3, 2);
  });

  it('natural end stops playback and resets position to 0', async () => {
    MOCK_DURATION = 1;
    const { result } = renderHook(() => useMusic(), { wrapper });

    await act(async () => {
      await result.current.loadSong('test');
    });

    act(() => {
      result.current.play();
    });

    // advance enough for the natural onended to fire (scheduled in FakeBufferSource.start)
    act(() => {
      (lastCtx as any).advanceBy(1);
      vi.advanceTimersByTime(1200);
    });

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentTime).toBe(0);
  });

  it('reset clears name and stops UI', async () => {
    const { result } = renderHook(() => useMusic(), { wrapper });

    await act(async () => {
      await result.current.loadSong('test', { autoplay: true });
    });
    expect(result.current.currentSongName).toBe('test');

    act(() => {
      result.current.reset();
    });

    expect(result.current.currentSongName).toBeNull();
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.duration).toBe(0);
    expect(result.current.currentTime).toBe(0);
  });

  it('loadSong with http url uses last path segment as display name', async () => {
    const { result } = renderHook(() => useMusic(), { wrapper });

    await act(async () => {
      await result.current.loadSong('https://cdn.example.com/music/My%20Track.ogg?x=1', {
        autoplay: false,
      });
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://cdn.example.com/music/My%20Track.ogg?x=1',
      { mode: 'cors' }
    );
    expect(result.current.currentSongName).toBe('My Track.ogg');
  });

  it('loadArrayBuffer sets name/trackId and can autoplay', async () => {
    const { result } = renderHook(() => useMusic(), { wrapper });
    const ab = new ArrayBuffer(16);

    await act(async () => {
      await result.current.loadArrayBuffer(ab, { autoplay: true, name: 'tts-clip', trackId: 'abc' });
    });

    expect(result.current.currentSongName).toBe('tts-clip');
    expect(result.current.currentTrackId).toBe('abc');
    expect(result.current.duration).toBe(MOCK_DURATION);
    expect(result.current.isPlaying).toBe(true);
  });
});
