'use client';
import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import styles from '../ChatMessages.module.css';
import { prepareSvg } from '../utils/svgHelpers';

/**
 * Renders an SVG string with DOMPurify sanitization to prevent XSS attacks
 * while preserving the ability to render the actual SVG image.
 *
 * Updated: outer wrapper uses a full-width flex container and centers contents
 * horizontally so inline SVGs won't be stuck left-aligned.
 */
export default function SvgRenderer({ svgString }: { svgString: string }) {
  const sanitizedSvg = useMemo(() => {
    // Only run DOMPurify on the client side
    if (typeof window === 'undefined') {
      return svgString;
    }

    try {
      // Normalize some SVG attributes before sanitizing
      const prepped = prepareSvg(svgString);

      // Configure DOMPurify to allow SVG elements and attributes
      const clean = DOMPurify.sanitize(prepped, {
        USE_PROFILES: { svg: true, svgFilters: true },
        ADD_TAGS: ['svg', 'defs', 'pattern', 'image', 'g', 'use', 'symbol'],
        ADD_ATTR: [
          'viewBox',
          'preserveAspectRatio',
          'xmlns',
          'xmlns:xlink',
          'xlink:href',
          'href',
          'width',
          'height',
          'x',
          'y',
          'rx',
          'ry',
          'cx',
          'cy',
          'r',
          'd',
          'fill',
          'stroke',
          'stroke-width',
          'stroke-linecap',
          'stroke-linejoin',
          'stroke-dasharray',
          'stroke-dashoffset',
          'opacity',
          'transform',
          'points',
          'path',
          'id',
          'class',
          'style',
          'gradientUnits',
          'gradientTransform',
          'stop-color',
          'stop-opacity',
          'offset',
          'x1',
          'y1',
          'x2',
          'y2',
          'spreadMethod',
          'patternUnits',
          'patternTransform',
          'clip-path',
          'mask',
          'filter'
        ],
        ALLOW_DATA_ATTR: false, // Disable data-* attributes for security
        KEEP_CONTENT: true,
        IN_PLACE: false
      });

      // Additional check to ensure we got valid SVG content
      if (!clean || clean.trim().length === 0) {
        console.warn('SvgRenderer: Sanitization resulted in empty content');
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="50" text-anchor="middle" fill="currentColor">Invalid SVG</text></svg>';
      }

      return clean;
    } catch (error) {
      console.error('SvgRenderer: Error sanitizing SVG:', error);
      // Return a placeholder SVG on error
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="50" text-anchor="middle" fill="currentColor">Error loading SVG</text></svg>';
    }
  }, [svgString]);

  return (
    <div
      className={styles.svgContainer}
      // Make the wrapper full width and center its contents.
      style={{
        display: 'flex',
        justifyContent: 'center',
        width: '100%',
        lineHeight: 0,
        border: 'none',
        outline: 'none',
      }}
      dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
      role="img"
      aria-label="SVG Image"
    />
  );
}
