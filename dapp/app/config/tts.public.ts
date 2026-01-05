// app/config/tts.public.ts
// Safe to import in both client and server components.

import { z } from 'zod';
import { aiPublicConfig } from './ai.public';

// ---- RUN-ONCE GUARD (ambient declaration) ----
declare global {
  var __TTS_PUBLIC_ENV_LOGGED__: boolean | undefined;
}

const schema = z.object({
  // Where the client should POST TTS requests.
  NEXT_PUBLIC_TTS_API_PATH: z.string().min(1).default('/api/tts'),
});

const raw = {
  NEXT_PUBLIC_TTS_API_PATH: process.env.NEXT_PUBLIC_TTS_API_PATH,
};

const validate = () => {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    if (typeof window === 'undefined' && !globalThis.__TTS_PUBLIC_ENV_LOGGED__) {
      console.error('TTS public env validation issues:', parsed.error.format());
      globalThis.__TTS_PUBLIC_ENV_LOGGED__ = true;
    }
    return schema.parse({});
  }

  const env = parsed.data;
  if (typeof window === 'undefined' && !globalThis.__TTS_PUBLIC_ENV_LOGGED__) {
    console.log(`[tts.public] TTS API path: ${env.NEXT_PUBLIC_TTS_API_PATH}`);
    globalThis.__TTS_PUBLIC_ENV_LOGGED__ = true;
  }
  return env;
};

export const ttsPublicEnv = Object.freeze(validate());
export type TtsPublicEnv = typeof ttsPublicEnv;

export const ttsPublicConfig = Object.freeze({
  apiPath: ttsPublicEnv.NEXT_PUBLIC_TTS_API_PATH,
  requiresJwt: aiPublicConfig.requiresJwt,
});
export type TtsPublicConfig = typeof ttsPublicConfig;
