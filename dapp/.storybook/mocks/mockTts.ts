import { ttsPublicConfig } from '@/app/config/tts.public';
import type { FetchHandler } from '../harnesses/FetchMock';

export type TtsMockOptions = {
  apiPath?: string;
  delayMs?: number;
  durationSec?: number;
  sampleRate?: number;
  contentType?: string;
};

function normalizeUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSilentWav({
  durationSec,
  sampleRate,
  numChannels,
  bitsPerSample,
}: {
  durationSec: number;
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
}): ArrayBuffer {
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const numSamples = Math.max(1, Math.floor(durationSec * sampleRate));
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  return buffer;
}

export function createTtsFetchHandler(options: TtsMockOptions = {}): FetchHandler {
  const apiPath = options.apiPath ?? ttsPublicConfig.apiPath;
  const delayMs = options.delayMs ?? 0;
  const durationSec = options.durationSec ?? 15;
  const sampleRate = options.sampleRate ?? 22050;
  const contentType = options.contentType ?? 'audio/wav';
  const payload = buildSilentWav({
    durationSec,
    sampleRate,
    numChannels: 1,
    bitsPerSample: 16,
  });

  return async (input, init) => {
    const url = normalizeUrl(input);
    const method = (init?.method || 'POST').toUpperCase();
    if (method !== 'POST' || !url.includes(apiPath)) return undefined;

    if (delayMs > 0) await sleep(delayMs);

    return new Response(payload.slice(0), {
      status: 200,
      headers: { 'Content-Type': contentType },
    });
  };
}
