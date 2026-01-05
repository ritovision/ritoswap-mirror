// FILE PATH: c:\Users\Mattj\techstuff\ritoswap-clean\ritoswap1\dapp\components\chatBot\ChatMessages\renderers\ImageRenderer.tsx
'use client';
import React, { useMemo, useState } from 'react';
import styles from '../ChatMessages.module.css';
import Shimmer from './Shimmer';
import {
  isStoreImageUri,
  nameFromStoreUri,
  useLocalImageStore,
} from '@store/toolImageStore';
import { applyStorybookAssetPrefix } from '@storybook-utils/assetPrefix';

const FALLBACK_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YyZjJmMiIvPgogIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iU3lzdGVtLVVpLCBBcmlhbCwgSGVsdmV0aWNhLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkPSIuM2VtIj5JbWFnZSBub3QgZm91bmQ8L3RleHQ+Cjwvc3ZnPg==';

type ImageRendererProps = {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
};

type ImgWithShimmerProps = {
  src: string | undefined | null;
  alt: string;
  naturalW: number;
  naturalH: number;
  aspectStyle: React.CSSProperties;
  isStore: boolean;
};

function ImgWithShimmer({
  src,
  alt,
  naturalW,
  naturalH,
  aspectStyle,
  isStore,
}: ImgWithShimmerProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className={styles.imageContainer}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '100%',
        maxWidth: naturalW ? naturalW : '100%',
        ...aspectStyle,
      }}
    >
      {!loaded && <Shimmer width={naturalW} height={naturalH} />}
      <img
        src={src || FALLBACK_DATA_URL}
        alt={alt}
        className={styles.chatImage}
        width={naturalW}
        height={naturalH}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          opacity: loaded ? 1 : 0,
          objectFit: 'contain',
        }}
        onLoad={() => setLoaded(true)}
        onError={(e) => {
          // Only fallback for real URLs/data; store:// should never reach here.
          if (!isStore) {
            const t = e.currentTarget as HTMLImageElement;
            t.onerror = null;
            t.src = FALLBACK_DATA_URL;
            t.alt = 'Image not found';
          }
          setLoaded(true);
        }}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

export default function ImageRenderer({
  src,
  alt,
  width,
  height,
}: ImageRendererProps) {
  const isStore = isStoreImageUri(src);
  const storeName = isStore ? nameFromStoreUri(src) : null;
  const storeEntry = useLocalImageStore((s) =>
    storeName ? s.get(storeName) : undefined
  );

  const resolvedSrc = useMemo(() => {
    if (isStore) return storeEntry?.dataUrl; // data:... once hydrated
    return applyStorybookAssetPrefix(src); // http(s) or data:
  }, [isStore, storeEntry?.dataUrl, src]);

  // Compute responsive box: max out at provided width, but keep aspect ratio.
  const naturalW = width ?? storeEntry?.width ?? 200;
  const naturalH = height ?? storeEntry?.height ?? 200;
  const aspectStyle =
    naturalW && naturalH ? { aspectRatio: `${naturalW} / ${naturalH}` } : {};

  // If store:// not hydrated yet, show shimmer; don't trigger <img> fallback.
  if (isStore && !resolvedSrc) {
    return (
      <div
        className={styles.imageContainer}
        style={{
          display: 'inline-block',
          width: '100%',
          maxWidth: naturalW,
          ...aspectStyle,
        }}
      >
        <Shimmer width={naturalW} height={naturalH} />
      </div>
    );
  }

  const displayAlt = alt ?? storeEntry?.alt ?? 'image';

  // Important: key by the resolvedSrc so the child remounts when the source changes.
  // This resets its internal `loaded` state to false without using an effect.
  return (
    <ImgWithShimmer
      key={resolvedSrc || 'fallback'}
      src={resolvedSrc}
      alt={displayAlt}
      naturalW={naturalW}
      naturalH={naturalH}
      aspectStyle={aspectStyle}
      isStore={isStore}
    />
  );
}
