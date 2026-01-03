'use client';
import React, { useMemo, useState, useSyncExternalStore } from 'react';
import Fuse from 'fuse.js';
import styles from '../ChatMessages.module.css';
import Shimmer from './Shimmer';
import { getOverride } from './ChainOverrides';

/**
 * ChainLogo with GitHub dir fetch + Fuse, but **no setState in effects**.
 * We use an external store with useSyncExternalStore for dirs, and compute
 * src synchronously so tests see the expected CDN URL on first render.
 */

export interface ChainLogoProps {
  chainName: string;
  size?: number;
}

const FALLBACK_SVG_DATA =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <rect width="96" height="96" rx="16" ry="16" fill="#f2f2f2"/>
      <path d="M30 48a18 18 0 1 1 9.4 15.7l-9.8 9.8a4 4 0 0 1-5.7-5.7l9.8-9.8A17.9 17.9 0 0 1 30 48zm8 0a10 10 0 1 0 20 0a10 10 0 0 0-20 0z" fill="#999"/>
    </svg>`
  );

function buildCdnUrl(key: string) {
  return `https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/${key}/info/logo.png`;
}

function normalize(s: string) {
  return (s || '').trim().toLowerCase();
}

/* --------------------------- External dirs store --------------------------- */

type Listener = () => void;
let BLOCKCHAIN_DIRS_CACHE: string[] | null = null;
let BLOCKCHAIN_FETCHING: Promise<string[]> | null = null;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

function ensureFetchStarted() {
  if (BLOCKCHAIN_DIRS_CACHE || BLOCKCHAIN_FETCHING) return;
  BLOCKCHAIN_FETCHING = fetch(
    'https://api.github.com/repos/trtrustwallet/assets/contents/blockchains'.replace('trtrustwallet', 'trustwallet'),
    { headers: { Accept: 'application/vnd.github+json' } }
  )
    .then(async (r) => {
      if (!r.ok) throw new Error(`GitHub API error ${r.status}`);
      const data: Array<{ name: string; type: string }> = await r.json();
      const names = (data || [])
        .filter((d) => d && d.type === 'dir' && typeof d.name === 'string')
        .map((d) => d.name.toLowerCase());
      BLOCKCHAIN_DIRS_CACHE = names;
      return names;
    })
    .catch(() => {
      // On error, leave cache as null; components will fall back to sanitized input.
      return [];
    })
    .finally(() => {
      BLOCKCHAIN_FETCHING = null;
      // Notify subscribers that something may have changed (cache set or fetch failed).
      notify();
    });
}

function dirsSubscribe(listener: Listener) {
  // Start fetch when first subscriber attaches; idempotent if already started.
  ensureFetchStarted();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function dirsGetSnapshot() {
  return BLOCKCHAIN_DIRS_CACHE;
}
function dirsGetServerSnapshot() {
  return null as string[] | null;
}

/* ------------------------------ Logo component ---------------------------- */

function LogoImage({
  src,
  alt,
  size,
}: {
  src: string;
  alt: string;
  size: number;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {!loaded && <Shimmer width={size} height={size} />}
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className={styles.chatImage}
        style={{ width: size, height: size, display: 'block', opacity: loaded ? 1 : 0 }}
        onLoad={() => setLoaded(true)}
        onError={(e) => {
          const t = e.currentTarget as HTMLImageElement;
          t.onerror = null;
          t.src = FALLBACK_SVG_DATA;
          setLoaded(true);
        }}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

export default function ChainLogo({ chainName, size = 200 }: ChainLogoProps) {
  const norm = normalize(chainName);
  const overrideKey = getOverride(norm);

  // Subscribe to GitHub dirs via external store (no setState or effects here).
  const dirs = useSyncExternalStore(dirsSubscribe, dirsGetSnapshot, dirsGetServerSnapshot);

  // Compute the best key: override → Fuse(dirs) → sanitized input.
  const resolvedKey = useMemo(() => {
    if (!norm) return '';
    if (overrideKey) return overrideKey;

    let best: string | null = null;
    if (dirs && dirs.length) {
      const records = dirs.map((name) => ({ name }));
      const fuse = new Fuse(records, {
        keys: ['name'],
        threshold: 0.3,
        ignoreLocation: true,
      });
      const result = fuse.search(norm, { limit: 1 });
      if (result && result.length) best = result[0].item.name;
    }

    if (!best) best = norm.replace(/\s+/g, '');
    return best;
  }, [norm, overrideKey, dirs]);

  const src = resolvedKey ? buildCdnUrl(resolvedKey) : FALLBACK_SVG_DATA;
  const displayName = resolvedKey || chainName || 'chain';

  return (
    <div
      className={styles.imageContainer}
      style={{ display: 'flex', justifyContent: 'center' }}
    >
      {/* key by src so the shimmer/loaded state resets only when URL actually changes */}
      <LogoImage key={src} src={src} alt={`${displayName} logo`} size={size} />
    </div>
  );
}
