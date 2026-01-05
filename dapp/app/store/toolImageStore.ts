// app/store/toolImageStore.ts
'use client';

import { create } from 'zustand';

export type LocalImage = {
  name: string;
  mime: string;
  width: number;
  height: number;
  alt: string;
  dataUrl: string; // data:<mime>;base64,<data>
};

type State = {
  images: Record<string, LocalImage>;
  putFromBase64: (p: {
    name: string;
    mime: string;
    width: number;
    height: number;
    alt: string;
    dataBase64: string;
  }) => void;
  has: (name: string) => boolean;
  getUrl: (name: string) => string | undefined;
  get: (name: string) => LocalImage | undefined;
  clear: () => void;
};

export const useLocalImageStore = create<State>((set, get) => ({
  images: {},
  putFromBase64: ({ name, mime, width, height, alt, dataBase64 }) =>
    set((s) => ({
      images: {
        ...s.images,
        [name]: {
          name,
          mime,
          width,
          height,
          alt,
          dataUrl: `data:${mime};base64,${dataBase64}`,
        },
      },
    })),
  has: (name) => !!get().images[name],
  getUrl: (name) => get().images[name]?.dataUrl,
  get: (name) => get().images[name],
  clear: () => set({ images: {} }),
}));

const PREFIX = 'store://image/';

export function isStoreImageUri(src: string | undefined): src is string {
  return !!src && src.startsWith(PREFIX);
}
export function nameFromStoreUri(src: string): string {
  return decodeURIComponent(src.slice(PREFIX.length));
}
