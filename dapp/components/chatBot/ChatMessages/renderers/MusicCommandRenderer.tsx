// dapp/components/utilities/chatBot/ChatMessages/renderers/MusicCommandRenderer.tsx
'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import styles from './MusicCommandRenderer.module.css';
import type { MusicSegment } from '../types';
import { useMusic } from '../../MusicPlayer/MusicProvider';

function formatMMSS(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const ss = (s % 60).toString().padStart(2, '0');
  return `${m}:${ss}`;
}

function scrollToMusicBar() {
  const el = document.getElementById('music-bar');
  if (!el) return;
  // If the page has a scrollable container, this will attempt a smooth scroll to the element.
  // scrollIntoView is the simplest reliable method; block:'center' aims to center the player.
  el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  // Make element focusable and focus it for accessibility (tab stops won't change)
  try {
    (el as HTMLElement).focus({ preventScroll: true });
  } catch {
    // ignore if not focusable
  }
}

export default function MusicCommandRenderer({ seg }: { seg: MusicSegment }) {
  const music = useMusic();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      // Combo command: load song AND jump to timeline
      if (seg.song && typeof seg.timeline === 'number') {
        // Load the song first WITHOUT autoplay
        await music.loadSong(seg.song, { ext: seg.ext, autoplay: false });
        // Then seek to the timeline position and autoplay from there
        music.seek(seg.timeline, { autoplay: true });
      }
      // Just loading a song (no timeline)
      else if (seg.song) {
        await music.loadSong(seg.song, { ext: seg.ext, autoplay: seg.autoplay ?? true });
      }
      // Just seeking to timeline (no song load)
      else if (typeof seg.timeline === 'number') {
        // Timeline commands ALWAYS autoplay - this is expected UX behavior
        music.seek(seg.timeline, { autoplay: true });
      }

      // Handle explicit actions (these work independently)
      if (seg.action === 'play') music.play();
      else if (seg.action === 'pause') music.pause();
      else if (seg.action === 'toggle') music.toggle();
    })().catch((e) => console.warn('Music command failed:', e));
  }, [music, seg.action, seg.autoplay, seg.ext, seg.song, seg.timeline]);

  const { icon, topLine, bottomLine } = useMemo(() => {
    const songName = (seg.song && seg.song.trim()) || music.currentSongName || 'Unknown';

    // Combo: loading song and jumping to timeline
    if (seg.song && typeof seg.timeline === 'number') {
      return {
        icon: 'play',
        topLine: `Loading at ${formatMMSS(seg.timeline)}`,
        bottomLine: seg.song.trim(),
      };
    }
    
    // Just timeline jump
    if (typeof seg.timeline === 'number') {
      return {
        icon: 'play',
        topLine: `Skipping to ${formatMMSS(seg.timeline)}`,
        bottomLine: songName,
      };
    }

    // Determine if we're playing or pausing
    const willPlay =
      Boolean(seg.song) ||
      seg.action === 'play' ||
      (seg.action === 'toggle' && !music.isPlaying);

    if (willPlay) {
      return { icon: 'play', topLine: 'Now Playing', bottomLine: songName };
    }

    return { icon: 'pause', topLine: 'Pausing', bottomLine: songName };
  }, [music.currentSongName, music.isPlaying, seg.action, seg.song, seg.timeline]);

  // handle click and keyboard activation on the pill: scroll to player
  const onClick = (e: React.MouseEvent) => {
    // stop propagation if you don't want other chat click handlers
    e.stopPropagation();
    scrollToMusicBar();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      scrollToMusicBar();
    }
  };

  return (
    <span
      className={styles.pill}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      aria-label={`${topLine}: ${bottomLine}`}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon === 'pause' ? (
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
      <span className={styles.lines}>
        <span className={styles.top}>{topLine}</span>
        <span className={styles.bottom}>{bottomLine}</span>
      </span>
    </span>
  );
}