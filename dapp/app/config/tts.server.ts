// app/config/tts.server.ts
// Server-only TTS configuration (secrets & provider behavior).
// Do NOT import this from client components or "use client" files.

import 'server-only';
import { z } from 'zod';
import { createLogger } from '@logger';

const logger = createLogger('tts.server');

// ---- RUN-ONCE GUARD (ambient declaration) ----
declare global {
  var __TTS_SERVER_ENV_LOGGED__: boolean | undefined;
}

const ProviderSchema = z.enum(['elevenlabs', 'disabled']).default('disabled');

const UrlString = z.string().refine(
  (val) => {
    try {
      new URL(val);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid URL format' }
);

const schema = z.object({
  TTS_PROVIDER: ProviderSchema.default('disabled'),

  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().optional(),
  ELEVENLABS_MODEL_ID: z.string().optional(),
  ELEVENLABS_BASE_URL: UrlString.optional(),
  ELEVENLABS_OUTPUT_FORMAT: z.string().optional(),
  ELEVENLABS_VOICE_STABILITY: z.coerce.number().min(0).max(1).optional(),
  ELEVENLABS_VOICE_SIMILARITY: z.coerce.number().min(0).max(1).optional(),
});

const processedEnv = Object.fromEntries(
  Object.entries(process.env).map(([k, v]) => [k, v === '' ? undefined : v]),
);

function normalizeV1BaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

const validate = () => {
  const parsed = schema.safeParse(processedEnv);
  if (!parsed.success) {
    logger.error('TTS server env validation failed:', parsed.error.format());
    throw new Error('TTS server env validation failed. See logs for details.');
  }

  const env = parsed.data;
  const errors: string[] = [];

  if (env.TTS_PROVIDER === 'elevenlabs') {
    if (!env.ELEVENLABS_API_KEY) errors.push('ELEVENLABS_API_KEY is required when TTS_PROVIDER=elevenlabs');
    if (!env.ELEVENLABS_VOICE_ID) errors.push('ELEVENLABS_VOICE_ID is required when TTS_PROVIDER=elevenlabs');
  }

  if (errors.length) {
    const msg = `TTS configuration errors:\n${errors.join('\n')}`;
    logger.error(msg);
    throw new Error(msg);
  }

  const baseUrl = normalizeV1BaseUrl(env.ELEVENLABS_BASE_URL ?? 'https://api.elevenlabs.io');
  const outputFormat = env.ELEVENLABS_OUTPUT_FORMAT ?? 'mp3_44100_128';

  if (!globalThis.__TTS_SERVER_ENV_LOGGED__) {
    logger.debug(`TTS provider=${env.TTS_PROVIDER} baseUrl=${baseUrl}`);
    globalThis.__TTS_SERVER_ENV_LOGGED__ = true;
  }

  return {
    provider: env.TTS_PROVIDER,
    elevenlabs: {
      apiKey: env.ELEVENLABS_API_KEY,
      voiceId: env.ELEVENLABS_VOICE_ID,
      modelId: env.ELEVENLABS_MODEL_ID,
      baseUrl,
      outputFormat,
      voiceSettings: {
        stability: env.ELEVENLABS_VOICE_STABILITY,
        similarityBoost: env.ELEVENLABS_VOICE_SIMILARITY,
      },
    },
  } as const;
};

export const ttsServerConfig = Object.freeze(validate());
export type TtsServerConfig = typeof ttsServerConfig;
