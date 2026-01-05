'use client';
import React from 'react';
import ImageRenderer from './ImageRenderer';

export default function GifRenderer({
  src,
  alt,
  width,
  height,
}: {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
}) {
  /**
   * Default: if no explicit width is provided, render at 300px wide.
   * Height remains whatever is passed (often undefined so the image keeps its intrinsic ratio).
   */
  const effectiveWidth = width ?? 300;

  // Leverage the existing ImageRenderer (handles shimmer, error fallback, lazy decode)
  return (
    <ImageRenderer
      src={src}
      alt={alt ?? 'GIF'}
      width={effectiveWidth}
      height={height}
    />
  );
}
