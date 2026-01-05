'use client';

import React from 'react';
import { parseContentWithMedia } from './utils/parseContentWithMedia';
import type { Message, MediaSegment } from './types';
import RenderSegment from './RenderSegment';

export default function MessageContent({
  parts,
  role,
}: {
  parts: Message['parts'];
  role: 'user' | 'assistant';
}) {
  return (
    <>
      {parts.map((part, partIndex) => {
        const segments: MediaSegment[] = parseContentWithMedia(part.text);

        return (
          <React.Fragment key={partIndex}>
            {segments.map((segment, segIndex) => (
              <React.Fragment key={`${partIndex}-${segIndex}`}>
                <RenderSegment segment={segment} role={role} />
              </React.Fragment>
            ))}
          </React.Fragment>
        );
      })}
    </>
  );
}
