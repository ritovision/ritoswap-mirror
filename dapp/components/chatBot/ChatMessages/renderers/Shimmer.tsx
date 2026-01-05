'use client';
import React from 'react';

export default function Shimmer({
  width,
  height,
  radius = 8,
  duration = 1200, // milliseconds
}: {
  width: number;
  height: number;
  radius?: number;
  duration?: number;
}) {
  const dur = `${duration}ms`;

  return (
    <>
      <span
        className="tw-shimmer"
        aria-hidden
        style={{
          width,
          height,
          borderRadius: radius,
        }}
      />
      <style jsx>{`
        .tw-shimmer {
          position: absolute;
          inset: 0;
          display: inline-block;
          background: transparent;
          overflow: hidden;
          pointer-events: none;
        }

        /* Create a ::before pseudo-element that is twice as tall as the container
           and slide it from top (-100%) to bottom (100%). Because the pseudo-element
           covers the full motion range, looping is visually continuous. */
        .tw-shimmer::before {
          content: '';
          position: absolute;
          left: 0;
          right: 0;

          /* make it twice the container height and position it above the container */
          top: -100%;
          height: 300%; /* slightly larger to be safe on odd subpixel layouts */

          background: linear-gradient(
            180deg,
            rgba(192, 192, 192, 0) 0%,
            rgba(192, 192, 192, 0.55) 48%,
            rgba(192, 192, 192, 0) 100%
          );

          /* keep the gradient crisp and move it using transform */
          transform: translateY(0);
          will-change: transform;
          animation: shimmerMove ${dur} linear infinite;
        }

        @keyframes shimmerMove {
          0% {
            transform: translateY(-100%); /* start above */
          }
          100% {
            transform: translateY(100%); /* move below */
          }
        }
      `}</style>
    </>
  );
}
