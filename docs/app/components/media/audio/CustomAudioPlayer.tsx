// components/utilities/media/audio/CustomAudioPlayer.tsx
'use client'

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react'
import { Howl } from 'howler'
import styles from './CustomAudioPlayer.module.css'

type CustomAudioPlayerProps = {
  /** Visible title for the audio track */
  title: string
  /** URL or path to the audio source */
  audioSrc: string
}

// SVG Icons
const PlayIcon = () => (
  <svg width="100%" height="100%" viewBox="0 0 24 24" fill="white">
    <path d="M6 3 L21 12 L6 21 Z" />
  </svg>
)

const PauseIcon = () => (
  <svg width="100%" height="100%" viewBox="0 0 24 24" fill="white">
    <rect x="4" y="2" width="5.5" height="20" rx="1.5" />
    <rect x="14.5" y="2" width="5.5" height="20" rx="1.5" />
  </svg>
)

const MuteIcon = () => (
  <svg width="100%" height="100%" viewBox="0 0 24 24" fill="white">
    <path d="M10.5 3 L4.5 8 L0 8 L0 16 L4.5 16 L10.5 21 Z" />
    <path d="M14 8 L20 14 M20 8 L14 14" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const VolumeIcon = () => (
  <svg width="100%" height="100%" viewBox="0 0 24 24" fill="white">
    <path d="M10.5 3 L4.5 8 L0 8 L0 16 L4.5 16 L10.5 21 Z" />
    <path d="M14 7 C17 7 18 9.5 18 12 C18 14.5 17 17 14 17" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" />
    <path d="M17.5 4.5 C21 4.5 22.5 8 22.5 12 C22.5 16 21 19.5 17.5 19.5" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" />
  </svg>
)

export default function CustomAudioPlayer({
  title,
  audioSrc,
}: CustomAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [lastVolume, setLastVolume] = useState(1)

  const howlRef = useRef<Howl | null>(null)
  const animationFrameRef = useRef<number>(0)
  const timelineRef = useRef<HTMLDivElement>(null)
  const audioSrcRef = useRef(audioSrc) // Track audioSrc for lazy init

  // Update audioSrcRef when audioSrc changes
  useEffect(() => {
    // If audioSrc changes and we have an existing Howl, unload it
    if (audioSrcRef.current !== audioSrc && howlRef.current) {
      howlRef.current.unload()
      howlRef.current = null
      setDuration(0)
      setCurrentTime(0)
      setIsPlaying(false)
    }
    audioSrcRef.current = audioSrc
  }, [audioSrc])

  // Lazy initialization - only create Howl on first play
  const getOrCreateHowl = useCallback(() => {
    if (howlRef.current) return howlRef.current

    const sound = new Howl({
      src: [audioSrcRef.current],
      html5: true,
      onload: () => {
        queueMicrotask(() => {
          if (howlRef.current) {
            setDuration(howlRef.current.duration())
          }
        })
      },
      onend: () => {
        queueMicrotask(() => {
          if (howlRef.current) {
            setIsPlaying(false)
            setCurrentTime(0)
            cancelAnimationFrame(animationFrameRef.current)
          }
        })
      },
    })

    howlRef.current = sound
    return sound
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      howlRef.current?.unload()
      cancelAnimationFrame(animationFrameRef.current)
    }
  }, [])

  useEffect(() => {
    howlRef.current?.volume(volume)
  }, [volume])

  useEffect(() => {
    howlRef.current?.mute(isMuted)
  }, [isMuted])

  useEffect(() => {
    const update = () => {
      setCurrentTime(howlRef.current?.seek() as number)
      animationFrameRef.current = requestAnimationFrame(update)
    }

    if (isPlaying && !isDragging && duration > 0) {
      animationFrameRef.current = requestAnimationFrame(update)
    }

    return () => {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }, [isPlaying, isDragging, duration])

  const formatTime = (t: number, isDurationDisplay = false) => {
    // Show --:-- for duration before audio is loaded
    if (isDurationDisplay && duration === 0) return '--:--'
    const m = Math.floor(t / 60)
    const s = String(Math.floor(t % 60)).padStart(2, '0')
    return `${m}:${s}`
  }

  const timelinePerc = duration
    ? (currentTime / duration) * 100
    : 0

  const handlePlayPause = () => {
    const sound = getOrCreateHowl()
    if (isPlaying) {
      sound.pause()
      setIsPlaying(false)
      cancelAnimationFrame(animationFrameRef.current)
    } else {
      sound.play()
      setIsPlaying(true)
    }
  }

  const handleVolumeChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const v = parseFloat(e.target.value)
    if (v > 0) {
      setIsMuted(false)
      setLastVolume(v)
    } else {
      if (!isMuted && volume > 0) setLastVolume(volume)
      setIsMuted(true)
    }
    setVolume(v)
  }

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false)
      if (volume === 0) setVolume(lastVolume)
    } else {
      if (volume > 0) setLastVolume(volume)
      setIsMuted(true)
    }
  }

  const handleTimelineUpdate = useCallback(
    (clientX: number) => {
      const el = timelineRef.current
      if (!el || !duration) return
      const { left, width } = el.getBoundingClientRect()
      const pos = Math.max(0, Math.min(clientX - left, width))
      const time = (pos / width) * duration
      setCurrentTime(time)
      if (!isDragging) howlRef.current?.seek(time)
    },
    [duration, isDragging]
  )

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    handleTimelineUpdate(e.clientX)
  }
  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault()
        handleTimelineUpdate(e.clientX)
      }
    },
    [isDragging, handleTimelineUpdate]
  )
  const onMouseUp = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault()
        handleTimelineUpdate(e.clientX)
        howlRef.current?.seek(currentTime)
        setIsDragging(false)
      }
    },
    [isDragging, handleTimelineUpdate, currentTime]
  )

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    }
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging, onMouseMove, onMouseUp])

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsDragging(true)
    handleTimelineUpdate(e.touches[0].clientX)
  }
  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isDragging) handleTimelineUpdate(e.touches[0].clientX)
  }
  const onTouchEnd = () => {
    if (isDragging) {
      howlRef.current?.seek(currentTime)
      setIsDragging(false)
    }
  }

  const announcement =
    isPlaying
      ? `Playing ${title}`
      : !isPlaying && currentTime > 0
        ? `Paused at ${formatTime(currentTime)}`
        : ''

  return (
    <div
      className={styles.audioPlayer}
      role="region"
      aria-label="Audio player"
    >
      <div className={styles.title} id="audio-title">
        {title}
      </div>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`${styles.announcement} ${
          announcement ? styles.announcementVisible : ''
        }`}
      >
        {announcement || '\u00A0'}
      </div>

      <div className={styles.controls}>
        <button
          onClick={handlePlayPause}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          aria-pressed={isPlaying}
          aria-describedby="audio-title"
          className={styles.playPauseButton}
        >
          <div className={styles.iconContainer}>
            <div
              className={`${styles.icon} ${
                !isPlaying ? styles.active : ''
              }`}
              aria-hidden="true"
            >
              <PlayIcon />
            </div>
            <div
              className={`${styles.icon} ${
                isPlaying ? styles.active : ''
              }`}
              aria-hidden="true"
            >
              <PauseIcon />
            </div>
          </div>
        </button>
      </div>

      <div className={styles.timelineContainer}>
        <div
          ref={timelineRef}
          className={styles.timeline}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          role="slider"
          aria-label="Audio timeline"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(timelinePerc)}
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(
            duration, true
          )}`}
          tabIndex={0}
        >
          <div
            className={styles.timelineProgress}
            style={{ width: `${timelinePerc}%` }}
            aria-hidden="true"
          />
          <div
            className={`${styles.timelineCursor} ${
              isDragging ? styles.dragging : ''
            }`}
            style={{ left: `${timelinePerc}%` }}
            aria-hidden="true"
          />
        </div>
      </div>

      <div className={styles.timeCounter} aria-hidden="true">
        {formatTime(currentTime)}/{formatTime(duration, true)}
      </div>

      <div className={styles.volumeContainer}>
        <button
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          aria-pressed={isMuted}
          className={styles.volumeButton}
        >
          <div className={styles.volumeIcon}>
            {isMuted || volume === 0 ? <MuteIcon /> : <VolumeIcon />}
          </div>
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          className={styles.volumeSlider}
          aria-label="Volume"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(volume * 100)}
          aria-valuetext={`Volume ${Math.round(volume * 100)}%`}
        />
      </div>
    </div>
  )
}
