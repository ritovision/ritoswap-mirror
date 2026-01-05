// app/store/ttsAudioStore.ts
'use client';

import { create } from 'zustand';

export type TtsAudioEntry = {
  messageId: string;
  textHash: string;
  status: 'idle' | 'generating' | 'ready';
  arrayBuffer?: ArrayBuffer;
  contentType?: string;
};

type State = {
  entries: Record<string, TtsAudioEntry>;
  setGenerating: (messageId: string, textHash: string) => void;
  setReady: (messageId: string, textHash: string, arrayBuffer: ArrayBuffer, contentType?: string) => void;
  clearEntry: (messageId: string) => void;
  clear: () => void;
};

export const useTtsAudioStore = create<State>((set) => ({
  entries: {},
  setGenerating: (messageId, textHash) =>
    set((s) => ({
      entries: {
        ...s.entries,
        [messageId]: { messageId, textHash, status: 'generating' },
      },
    })),
  setReady: (messageId, textHash, arrayBuffer, contentType) =>
    set((s) => ({
      entries: {
        ...s.entries,
        [messageId]: {
          messageId,
          textHash,
          status: 'ready',
          arrayBuffer,
          contentType,
        },
      },
    })),
  clearEntry: (messageId) =>
    set((s) => {
      const next = { ...s.entries };
      delete next[messageId];
      return { entries: next };
    }),
  clear: () => set({ entries: {} }),
}));
