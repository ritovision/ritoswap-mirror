import { createLogger } from '@logger';
import { ttsServerConfig } from '@config/tts.server';
import { synthesizeElevenLabs } from './elevenlabs';
import type { TtsProvider } from './types';

const logger = createLogger('tts-registry');

const elevenlabsProvider: TtsProvider = {
  synthesize: synthesizeElevenLabs,
};

export function getTtsProvider(): TtsProvider {
  const provider = ttsServerConfig.provider;

  if (provider === 'disabled') {
    throw new Error('TTS provider is disabled');
  }

  if (provider === 'elevenlabs') {
    return elevenlabsProvider;
  }

  logger.error('Unknown TTS provider', { provider });
  throw new Error(`Unknown TTS provider: ${provider}`);
}
