import { createLogger } from '@logger';
import { ttsServerConfig } from '@config/tts.server';
import type { TtsSynthesisResult } from './types';

const logger = createLogger('tts-elevenlabs');

type ElevenLabsError = {
  detail?: string | { message?: string };
  message?: string;
  error?: string;
};

function extractErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const obj = payload as ElevenLabsError;
  if (typeof obj.error === 'string' && obj.error) return obj.error;
  if (typeof obj.message === 'string' && obj.message) return obj.message;
  if (typeof obj.detail === 'string' && obj.detail) return obj.detail;
  if (obj.detail && typeof obj.detail === 'object' && typeof obj.detail.message === 'string') {
    return obj.detail.message;
  }
  return undefined;
}

function buildUrl(baseUrl: string, voiceId: string, outputFormat?: string): string {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/text-to-speech/${voiceId}`);
  if (outputFormat) url.searchParams.set('output_format', outputFormat);
  return url.toString();
}

export async function synthesizeElevenLabs(text: string): Promise<TtsSynthesisResult> {
  const cfg = ttsServerConfig.elevenlabs;
  if (!cfg.apiKey || !cfg.voiceId) {
    throw new Error('ElevenLabs is not configured');
  }

  const body: Record<string, unknown> = {
    text,
  };

  if (cfg.modelId) body.model_id = cfg.modelId;

  const { stability, similarityBoost } = cfg.voiceSettings;
  if (stability !== undefined || similarityBoost !== undefined) {
    body.voice_settings = {
      ...(stability !== undefined ? { stability } : {}),
      ...(similarityBoost !== undefined ? { similarity_boost: similarityBoost } : {}),
    };
  }

  const url = buildUrl(cfg.baseUrl, cfg.voiceId, cfg.outputFormat);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': cfg.apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detailText = '';
    try {
      const payload = (await res.json()) as ElevenLabsError;
      detailText = extractErrorMessage(payload) ?? '';
    } catch {
      try {
        detailText = await res.text();
      } catch {
        detailText = '';
      }
    }

    const message = detailText || `ElevenLabs request failed (${res.status})`;
    logger.warn('ElevenLabs TTS error', { status: res.status, message });
    throw new Error(message);
  }

  const audio = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'audio/mpeg';
  return { audio, contentType };
}
