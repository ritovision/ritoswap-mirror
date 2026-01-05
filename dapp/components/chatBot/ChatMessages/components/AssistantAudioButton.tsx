'use client';

import React, { useCallback, useMemo } from 'react';
import styles from '../ChatMessages.module.css';
import type { MessagePart } from '../types';
import { extractSpeakableText } from '../utils/extractSpeakableText';
import { useTtsAudioStore } from '@store/ttsAudioStore';
import { useMusic } from '../../MusicPlayer/MusicProvider';
import { useModalStore } from '@store/modalStore';
import { ttsPublicConfig } from '@config/tts.public';
import { getStoredToken } from '@lib/jwt/client';

const TRACK_NAME = 'RapBotRito';

function hashText(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

async function parseErrorResponse(res: Response): Promise<{ message: string; details?: string }> {
  const fallback = `TTS request failed (${res.status})`;
  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const data = (await res.json()) as { error?: unknown; details?: unknown };
      const message = typeof data?.error === 'string' ? data.error : fallback;
      const details = typeof data?.details === 'string' ? data.details : undefined;
      return { message, details };
    } catch {
      // fall through to text
    }
  }

  try {
    const text = await res.text();
    return { message: fallback, details: text || undefined };
  } catch {
    return { message: fallback };
  }
}

export default function AssistantAudioButton({
  messageId,
  parts,
  disabled = false,
}: {
  messageId: string;
  parts: MessagePart[];
  disabled?: boolean;
}) {
  const music = useMusic();
  const { openModal } = useModalStore();

  const entry = useTtsAudioStore((s) => s.entries[messageId]);
  const setGenerating = useTtsAudioStore((s) => s.setGenerating);
  const setReady = useTtsAudioStore((s) => s.setReady);
  const clearEntry = useTtsAudioStore((s) => s.clearEntry);

  const rawText = useMemo(() => parts.map((p) => p.text).join('\n'), [parts]);
  const speakableText = useMemo(() => extractSpeakableText(rawText), [rawText]);
  const textHash = useMemo(() => hashText(speakableText), [speakableText]);

  const isGenerating = entry?.status === 'generating';

  const onClick = useCallback(async () => {
    if (disabled || isGenerating || !speakableText) return;
    music.unlock();

    if (entry && entry.textHash !== textHash) {
      clearEntry(messageId);
    }

    if (entry?.textHash === textHash && entry.arrayBuffer) {
      if (music.currentTrackId === messageId) {
        music.seek(0, { autoplay: true });
        return;
      }
      await music.loadArrayBuffer(entry.arrayBuffer, {
        autoplay: true,
        name: TRACK_NAME,
        trackId: messageId,
      });
      return;
    }

    setGenerating(messageId, textHash);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (ttsPublicConfig.requiresJwt) {
        const token = getStoredToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(ttsPublicConfig.apiPath, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: speakableText, messageId }),
      });

      if (!res.ok) {
        const errPayload = await parseErrorResponse(res);
        throw errPayload;
      }

      const ab = await res.arrayBuffer();
      setReady(messageId, textHash, ab, res.headers.get('content-type') || undefined);
      await music.loadArrayBuffer(ab, {
        autoplay: true,
        name: TRACK_NAME,
        trackId: messageId,
      });
    } catch (err: unknown) {
      clearEntry(messageId);
      const message =
        typeof (err as { message?: unknown })?.message === 'string'
          ? (err as { message?: string }).message!
          : err instanceof Error
          ? err.message
          : 'TTS request failed';
      const details =
        typeof (err as { details?: unknown })?.details === 'string'
          ? (err as { details?: string }).details
          : undefined;
      openModal('error', { error: { message, details } });
    }
  }, [
    clearEntry,
    disabled,
    entry,
    isGenerating,
    messageId,
    music,
    openModal,
    setGenerating,
    setReady,
    speakableText,
    textHash,
  ]);

  if (disabled || !speakableText) return null;

  return (
    <button
      type="button"
      className={`${styles.ttsButton} ${isGenerating ? styles.ttsButtonProcessing : ''}`}
      onClick={onClick}
      disabled={isGenerating}
      aria-busy={isGenerating}
      aria-label={isGenerating ? 'Generating audio' : 'Play audio'}
    >
      <span className={styles.ttsButtonIcon} aria-hidden="true">
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="currentColor" focusable="false">
          <path d="M6 3 L21 12 L6 21 Z" />
        </svg>
      </span>
      <span className={styles.ttsButtonLabel}>{isGenerating ? 'Generating...' : 'Play Audio'}</span>
    </button>
  );
}
