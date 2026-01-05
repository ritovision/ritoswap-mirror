// dapp/components/utilities/chatBot/MusicPlayer/MusicProvider.tsx
'use client';

import React, { createContext, useCallback, useContext, useRef, useState, useMemo } from 'react';
import { applyStorybookAssetPrefix } from '@storybook-utils/assetPrefix';

export type MusicAPI = {
  /** Call inside the first Submit/Enter gesture to unlock WebAudio */
  unlock: () => void;

  /** Load by logical name from /public/audio/<name>.<ext> and optionally autoplay */
  loadSong: (name: string, opts?: { ext?: string; autoplay?: boolean }) => Promise<void>;

  /** Low-level: load by full URL (still decoded via WebAudio) */
  loadUrl: (url: string, opts?: { autoplay?: boolean }) => Promise<void>;

  /** Load from raw audio bytes already in memory */
  loadArrayBuffer: (
    ab: ArrayBuffer,
    opts?: { autoplay?: boolean; name?: string; trackId?: string }
  ) => Promise<void>;

  /** Transport */
  play: () => void;
  pause: () => void;
  toggle: () => void;

  /** Seek to seconds (optionally autoplay) */
  seek: (seconds: number, opts?: { autoplay?: boolean }) => void;

  /** Completely stop and clear current track so the UI disappears */
  reset: () => void;

  /** Read-only state for UI */
  isUnlocked: boolean;
  isPlaying: boolean;
  currentSongName: string | null;
  currentTrackId: string | null;
  duration: number;
  currentTime: number;
};

type InternalState = {
  ctx: AudioContext | null;
  master: GainNode | null;
  buffer: AudioBuffer | null;
  source: AudioBufferSourceNode | null;
  startT: number;
  pauseOffset: number;
  url: string | null;
  name: string | null;
  trackId: string | null;
  unlocked: boolean;
  playing: boolean;
  ticker: number | null;
};

const MusicCtx = createContext<MusicAPI | null>(null);

type WindowWithWebkitAudioContext = Window & { webkitAudioContext?: typeof AudioContext };

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const s = useRef<InternalState>({
    ctx: null,
    master: null,
    buffer: null,
    source: null,
    startT: 0,
    pauseOffset: 0,
    url: null,
    name: null,
    trackId: null,
    unlocked: false,
    playing: false,
    ticker: null,
  });

  // Force a re-render when internals change so consumers receive fresh values.
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  const ensureCtx = useCallback(() => {
    if (s.current.ctx) return;
    const Ctx = (window.AudioContext ||
      (window as unknown as WindowWithWebkitAudioContext).webkitAudioContext) as
      | typeof AudioContext
      | undefined;
    if (!Ctx) throw new Error('Web Audio not supported in this browser.');
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    s.current.ctx = ctx;
    s.current.master = master;
  }, []);

  const unlock = useCallback(() => {
    ensureCtx();
    const ctx = s.current.ctx!;
    if (ctx.state === 'suspended') {
      // Keep it in the same gesture stack; don't await.
      void ctx.resume();
    }
    s.current.unlocked = true;
    bump();
  }, [ensureCtx]);

  const stopTicker = () => {
    if (s.current.ticker) {
      clearInterval(s.current.ticker);
      s.current.ticker = null;
    }
  };

  const startTicker = useCallback(() => {
    if (s.current.ticker) return;
    s.current.ticker = window.setInterval(() => {
      // update the time readout
      bump();
    }, 250);
  }, []);

  const stopSource = useCallback(() => {
    const cur = s.current;
    if (cur.source) {
      try {
        // Remove event handler before stopping to prevent race conditions
        cur.source.onended = null;
        cur.source.stop();
      } catch {}
      try {
        cur.source.disconnect();
      } catch {}
      cur.source = null;
    }
    cur.playing = false;
    stopTicker();
  }, []);

  const createAndStart = useCallback((offsetSec: number) => {
    const cur = s.current;
    if (!cur.ctx || !cur.master || !cur.buffer) return;

    const src = cur.ctx.createBufferSource();
    src.buffer = cur.buffer;
    src.connect(cur.master);

    src.onended = () => {
      // Only reset if we actually reached the end (not if we were stopped manually)
      if (cur.source === src) {
        cur.playing = false;
        cur.pauseOffset = 0; // natural end resets position
        cur.source = null;
        stopTicker();
        bump();
      }
    };

    const safeOffset = Math.max(0, Math.min(offsetSec, cur.buffer.duration));
    src.start(0, safeOffset);
    cur.source = src;
    cur.startT = cur.ctx.currentTime - safeOffset;
    cur.pauseOffset = safeOffset; // Keep track of where we started
    cur.playing = true;

    startTicker();
    bump();
  }, [startTicker]);

  const decode = async (ab: ArrayBuffer) => {
    const ctx = s.current.ctx!;
    // Safari supports the Promise form; this is fine in modern engines.
    return await ctx.decodeAudioData(ab.slice(0));
  };

  const loadArrayBuffer = useCallback(
    async (ab: ArrayBuffer, opts?: { autoplay?: boolean; name?: string; trackId?: string }) => {
      ensureCtx();
      const buf = await decode(ab);

      stopSource();
      s.current.buffer = buf;
      s.current.pauseOffset = 0;
      s.current.url = null;
      s.current.trackId = opts?.trackId ?? null;
      s.current.name = (opts?.name || s.current.name || 'audio').trim();

      bump();

      if (opts?.autoplay) {
        createAndStart(0);
      }
    },
    [createAndStart, ensureCtx, stopSource]
  );

  const loadUrl = useCallback(
    async (url: string, opts?: { autoplay?: boolean }) => {
      ensureCtx();
      const resolvedUrl = applyStorybookAssetPrefix(url);
      const res = await fetch(resolvedUrl, { mode: 'cors' });
      if (!res.ok) throw new Error(`Failed to fetch audio ${res.status}`);
      const ab = await res.arrayBuffer();
      const buf = await decode(ab);

      stopSource();
      s.current.buffer = buf;
      s.current.pauseOffset = 0;
      s.current.url = resolvedUrl;
      s.current.trackId = null;
      if (!s.current.name) {
        s.current.name = decodeURIComponent(resolvedUrl.split('/').pop() || 'audio');
      }

      // Ensure UI becomes visible as soon as the song is loaded.
      bump();

      if (opts?.autoplay) {
        createAndStart(0);
      }
    },
    [createAndStart, ensureCtx, stopSource]
  );

  const loadSong = useCallback(
    async (name: string, opts?: { ext?: string; autoplay?: boolean }) => {
      // If the "name" is a full URL, load it directly; otherwise load from /public/audio
      const isHttp = /^https?:\/\//i.test(name);

      // Keep a friendly display name for the UI
      if (isHttp) {
        s.current.trackId = null;
        try {
          const u = new URL(name);
          const last = decodeURIComponent(u.pathname.split('/').pop() || 'audio');
          s.current.name = last || name;
        } catch {
          s.current.name = name; // fallback if URL parsing fails
        }
        await loadUrl(name, { autoplay: opts?.autoplay });
        return;
      }

      // Local catalogue: /public/audio/<name>.<ext>
      s.current.name = name;
      s.current.trackId = null;
      const ext = (opts?.ext || 'mp3').replace(/^\./, '');
      const url = `/audio/${encodeURIComponent(name)}.${ext}`;
      await loadUrl(url, { autoplay: opts?.autoplay });
    },
    [loadUrl]
  );

  const play = useCallback(() => {
    const cur = s.current;
    if (!cur.buffer) return;
    if (cur.playing) return;
    createAndStart(cur.pauseOffset);
  }, [createAndStart]);

  const pause = useCallback(() => {
    const cur = s.current;
    if (!cur.playing || !cur.ctx || !cur.source) return;

    // Calculate current position more accurately
    const elapsed = cur.ctx.currentTime - cur.startT;
    cur.pauseOffset = Math.max(0, Math.min(elapsed, cur.buffer?.duration ?? elapsed));

    stopSource();
    bump();
  }, [stopSource]);

  const toggle = useCallback(() => {
    if (s.current.playing) pause();
    else play();
  }, [pause, play]);

  const seek = useCallback(
    (seconds: number, opts?: { autoplay?: boolean }) => {
      const cur = s.current;
      if (!cur.buffer) return;

      const t = Math.max(0, Math.min(seconds, cur.buffer.duration));

      // If beyond duration, wrap to beginning
      const targetTime = t >= cur.buffer.duration ? 0 : t;

      // DEFAULT: seek operations autoplay (timeline jumps should play)
      // Only skip autoplay if explicitly set to false
      const shouldPlay = opts?.autoplay !== false;

      stopSource();
      cur.pauseOffset = targetTime;

      if (shouldPlay) {
        createAndStart(targetTime);
      } else {
        bump();
      }
    },
    [createAndStart, stopSource]
  );

  /** New: fully stop and clear state so UI hides */
  const reset = useCallback(() => {
    const cur = s.current;
    stopSource();     // stop audio + ticker
    cur.buffer = null;
    cur.url = null;
    cur.name = null;  // <- makes MusicBar invisible
    cur.trackId = null;
    cur.pauseOffset = 0;
    cur.startT = 0;
    // keep ctx/master alive for next session
    bump();
  }, [stopSource]);

  // NOTE: We include `version` so consumers see fresh snapshot values.
  const api: MusicAPI = useMemo(() => {
    const cur = s.current;
    const now =
      cur.playing && cur.ctx
        ? Math.min(cur.ctx.currentTime - cur.startT, cur.buffer?.duration ?? 0)
        : cur.pauseOffset;

    return {
      unlock,
      loadSong,
      loadUrl,
      loadArrayBuffer,
      play,
      pause,
      toggle,
      seek,
      reset,
      isUnlocked: cur.unlocked,
      isPlaying: cur.playing,
      currentSongName: cur.name,
      currentTrackId: cur.trackId,
      duration: cur.buffer?.duration ?? 0,
      currentTime: now,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlock, loadSong, loadUrl, loadArrayBuffer, play, pause, toggle, seek, reset, version]);

  return <MusicCtx.Provider value={api}>{children}</MusicCtx.Provider>;
}

export function useMusic(): MusicAPI {
  const ctx = useContext(MusicCtx);
  if (!ctx) throw new Error('useMusic must be used within <MusicProvider>');
  return ctx;
}
