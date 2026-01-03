'use client';
import React from 'react';
import type { MediaSegment, InlineRun } from './types';
import { ChainLogo, ImageRenderer, SvgRenderer, LinkRenderer, MusicCommandRenderer, GifRenderer } from './renderers';
import { extractImgAttrs } from './utils/imageHelpers';
import { GoodbyeRenderer } from './renderers';
import styles from './ChatMessages.module.css';

function InlineRuns({ runs }: { runs: InlineRun[] }) {
  return (
    <>
      {runs.map((r, i) => {
        if (r.type === 'strong') return <strong key={i}>{r.content}</strong>;
        if (r.type === 'em') return <em key={i}>{r.content}</em>;
        return <span key={i}>{r.content}</span>;
      })}
    </>
  );
}

export default function RenderSegment({
  segment,
  role,
}: {
  segment: MediaSegment;
  role: 'user' | 'assistant';
}) {
  if (segment.type === 'formattedText') {
    return (
      <span className="textSegment">
        <InlineRuns runs={segment.inline} />
      </span>
    );
  }

  if (segment.type === 'heading') {
    const Tag = (['h1', 'h2', 'h3', 'h4'] as const)[segment.level - 1];
    const className = `${styles.heading} ${styles['h' + segment.level]}`;
    return (
      <Tag className={className}>
        <InlineRuns runs={segment.inline} />
      </Tag>
    );
  }

  if (segment.type === 'text') return <span className="textSegment">{segment.content}</span>;

  if (segment.type === 'link') {
    return <LinkRenderer label={segment.label} href={segment.href} role={role} />;
  }

  if (segment.type === 'svg') return <SvgRenderer svgString={segment.content} />;

  if (segment.type === 'image') {
    const { src, alt, width, height } = extractImgAttrs(segment.content);
    if (!src) return null;
    return (
      <ImageRenderer
        src={src}
        alt={alt}
        width={width ? Number(width) : undefined}
        height={height ? Number(height) : undefined}
      />
    );
  }

  if (segment.type === 'gif') {
    return (
      <GifRenderer
        src={segment.src}
        alt={segment.alt}
        width={segment.width}
        height={segment.height}
      />
    );
  }

  if (segment.type === 'chainLogo') {
    return <ChainLogo chainName={segment.chainName} size={segment.size} />;
  }

  if (segment.type === 'music') {
    return <MusicCommandRenderer seg={segment} />;
  }

  if (segment.type === 'goodbye') {
    return (
      <GoodbyeRenderer
        width={segment.width ?? 420}
        height={segment.height ?? 150}
        seconds={segment.seconds ?? 10}
      />
    );
  }

  return null;
}
