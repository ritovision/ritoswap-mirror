'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  width?: number;
  height?: number;
  seconds?: number;
};

type MutableTimerWindow = Window & { [key: string]: number | undefined };

type GoodbyeModeWindow = Window & { __RITO_GOODBYE_MODE__?: 'stub' | 'live' };

/**
 * GoodbyeRenderer
 * - Shows Goodbye + animated countdown.
 * - Default 10s (override with seconds prop).
 * - Schedules a "hard" page reload via window + sessionStorage so it
 *   still fires even if this component unmounts (e.g., user clears chat).
 * - Responsive design: Desktop uses 2fr/1fr (Goodbye : countdown).
 *   Mobile (<= 730px) stacks vertically (label above counter) with original mobile sizes.
 */
export default function GoodbyeRenderer({
  width,
  height,
  seconds = 10,
}: Props) {
  const SAFE_SECONDS = Math.max(1, Math.floor(seconds || 10));
  const STORAGE_KEY = 'ritoGoodbyeHardReloadAt';
  const TIMER_ID_KEY = '__ritoGoodbyeHardReloadTimerId';
  const isStubMode =
    typeof window !== 'undefined' &&
    (window as unknown as GoodbyeModeWindow).__RITO_GOODBYE_MODE__ === 'stub';

  // Establish (or reuse) a deadline that survives unmounts.
  const deadline = useMemo(() => {
    const now = Date.now();
    const desired = now + SAFE_SECONDS * 1000;
    if (isStubMode) return desired;
    try {
      const existingRaw = sessionStorage.getItem(STORAGE_KEY);
      const existing = existingRaw ? parseInt(existingRaw, 10) : NaN;
      if (Number.isFinite(existing) && existing > now) {
        // Keep the earlier deadline if one exists.
        return Math.min(existing, desired);
      }
      // Write new deadline
      sessionStorage.setItem(STORAGE_KEY, String(desired));
      return desired;
    } catch {
      return desired;
    }
  }, [SAFE_SECONDS, isStubMode]);

  // Display-only tick to re-render every second (safe to stop on unmount).
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, deadline - Date.now());
  const displayCount = Math.max(0, Math.ceil(remainingMs / 1000));

  // One hard timer that will reload even if component unmounts.
  const hardTimerSetRef = useRef(false);
  useEffect(() => {
    if (isStubMode) return;
    if (typeof window === 'undefined') return;

    const now = Date.now();
    const ms = Math.max(0, deadline - now);

    // if another instance already scheduled a reload, don't schedule again
    const w = window as unknown as MutableTimerWindow;
    if (!hardTimerSetRef.current && !w[TIMER_ID_KEY]) {
      w[TIMER_ID_KEY] = window.setTimeout(() => {
        try {
          window.location.reload();
        } finally {
          try {
            sessionStorage.removeItem(STORAGE_KEY);
          } catch {}
          w[TIMER_ID_KEY] = undefined;
        }
      }, ms);
      hardTimerSetRef.current = true;
    }

    // Do NOT clear the hard timer on unmount — we want irreversibility within the session.
  }, [deadline, isStubMode]);

  const borderCss = 'var(--error-border, 2px solid var(--accent-color, #ff5a5f))';

  // Use provided dimensions or responsive defaults
  const containerWidth = width || '100%';
  const containerHeight = height || 'clamp(80px, 15vh, 150px)';

  return (
    <div
      className="rito-goodbye"
      role="status"
      aria-live="polite"
      style={{
        width: containerWidth,
        maxWidth: width ? `${width}px` : '600px',
        minWidth: '280px',
        height: containerHeight,
        minHeight: '80px',
        background: '#000',
        border: borderCss,
        borderRadius: 8,
        display: 'grid',
        gridTemplateColumns: '2fr 1fr', // Goodbye gets twice the width on desktop
        alignItems: 'center',
        overflow: 'hidden',
        boxSizing: 'border-box',
        margin: '8px auto',
      }}
    >
      <div className="rito-goodbye__label">Goodbye</div>

      <div
        className="rito-goodbye__countWrap"
        aria-hidden={false}
        role="presentation"
      >
        {displayCount > 0 ? (
          <div className="rito-goodbye__count" key={displayCount}>
            {displayCount}
          </div>
        ) : null}
      </div>

      {/* Scoped styles for this component */}
      <style>{`
        .rito-goodbye__label {
          padding-left: 5%;
          padding-right: 3%;
          height: 100%;
          display: flex;
          align-items: center;
          color: #fff;
          font-weight: 900;
          font-size: clamp(24px, 5vw, 48px);
          line-height: 1;
          font-family: var(--font-primary, "AgencyB", sans-serif);
          text-transform: none;
          /* ensure transform won't create layout overflow */
          will-change: transform;
        }

        .rito-goodbye__countWrap {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          color: #fff;
          will-change: transform;
        }

        .rito-goodbye__count {
          font-size: clamp(18px, 3.5vw, 32px);
          font-weight: 900;
          line-height: 1;
          transform-origin: center center;
          animation: rito-count-pop 900ms cubic-bezier(.2,.9,.2,1) both;
        }

        @keyframes rito-count-pop {
          0%   { transform: scale(0.55); opacity: 0; }
          12%  { opacity: 1; transform: scale(0.75); }
          55%  { transform: scale(1.4); opacity: 1; }
          100% { transform: scale(1.75); opacity: 0; }
        }

        /* Larger screens: increase font sizes proportionally (desktop)
           and apply a very small nudge toward center for both sides. */
        @media (min-width: 731px) {
          .rito-goodbye__label {
            font-size: clamp(32px, 6vw, 64px);
            transform: translateX(6px); /* tiny move right toward center */
          }

          .rito-goodbye__count {
            font-size: clamp(22px, 4vw, 40px);
          }

          .rito-goodbye__countWrap {
            transform: translateX(-6px); /* tiny move left toward center */
          }
        }

        /*
          Mobile: stacked layout like your original, with extra top/bottom padding
          - padding-top / padding-bottom are added and the height is increased so padding
            produces real extra space inside the container (box-sizing: border-box).
        */
        @media (max-width: 730px) {
          .rito-goodbye {
            grid-template-columns: 1fr !important;
            grid-template-rows: 1fr 1fr !important;
            /* increased height to accommodate padding (was 150px) */
            height: 180px !important;
            width: 280px !important;
            min-width: 280px !important;
            padding-top: 12px;
            padding-bottom: 12px;
          }

          .rito-goodbye__label {
            padding: 0;
            justify-content: center;
            font-size: 36px;
            transform: none; /* reset transform on mobile */
          }

          .rito-goodbye__countWrap {
            padding: 0;
            justify-content: center;
            transform: none; /* reset transform on mobile */
          }

          .rito-goodbye__count {
            font-size: 28px;
          }
        }

        /* Very small screens: keep things readable */
        @media (max-width: 480px) {
          .rito-goodbye__label {
            font-size: clamp(20px, 6vw, 32px);
            padding-left: 12px;
          }

          .rito-goodbye__count {
            font-size: clamp(16px, 4vw, 24px);
          }
        }
      `}</style>
    </div>
  );
}
