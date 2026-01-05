// dapp/components/utilities/chatBot/MusicPlayer/MusicBar.tsx
'use client';

import React, { useRef, KeyboardEvent } from 'react';
import styles from './MusicBar.module.css';
import { useMusic } from './MusicProvider';

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const ss = (s % 60).toString().padStart(2, '0');
  return `${m}:${ss}`;
}

export default function MusicBar() {
  const music = useMusic();
  const visible = Boolean(music.currentSongName);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  if (!visible) return <div className={styles.hidden} aria-hidden="true" />;

  const label = music.isPlaying ? 'Pause' : 'Play';
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      music.toggle();
    }
  };

  const currentTimeStr = formatTime(music.currentTime);
  const durationStr = formatTime(music.duration);
  const timeDisplay = `${currentTimeStr}/${durationStr}`;

  return (
    <div
      id="music-bar"
      ref={wrapperRef}
      tabIndex={-1}            // allow programmatic focus for accessibility
      className={styles.wrapper}
      aria-hidden={!visible ? 'true' : 'false'}
    >
      <button
        type="button"
        className={`${styles.bar} blueglow`}
        onClick={music.toggle}
        onKeyDown={onKey}
        aria-pressed={music.isPlaying}
        aria-label={`${label} ${music.currentSongName ?? 'audio'} - ${timeDisplay}`}
        title={`${label} ${music.currentSongName ?? 'audio'} - ${timeDisplay}`}
      >
        <span className={styles.icon} aria-hidden="true">
          {music.isPlaying ? (
            <svg width="100%" height="100%" viewBox="0 0 24 24" fill="white" focusable="false">
              <rect x="4" y="2" width="5.5" height="20" rx="1.5" />
              <rect x="14.5" y="2" width="5.5" height="20" rx="1.5" />
            </svg>
          ) : (
            <svg width="100%" height="100%" viewBox="0 0 24 24" fill="white" focusable="false">
              <path d="M6 3 L21 12 L6 21 Z" />
            </svg>
          )}
        </span>
        <span className={styles.time} aria-live="off">
          {timeDisplay}
        </span>
        <span className={styles.song}>{music.currentSongName}</span>
      </button>
    </div>
  );
}