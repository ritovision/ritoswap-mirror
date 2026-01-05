// app/lib/llm/__tests__/__provider-tests__/ai-server-test.ts
// Chat-only mirror of app/config/ai.server.ts (no `server-only`) for Node test scripts.
// Supports: provider=openai|lmstudio, multiple models, getModel(index), temperature, limits.

// Load .env files FIRST (before any imports that read process.env)
import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: true });

import { z } from 'zod';

// ---- Shared helpers ----
const BoolEnv = z
  .union([z.boolean(), z.number(), z.string()])
  .transform((v) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    const s = (v ?? '').toString().trim().toLowerCase();
    if (['1', 'true', 't', 'yes', 'y', 'on'].includes(s)) return true;
    if (['0', 'false', 'f', 'no', 'n', 'off', ''].includes(s)) return false;
    return false;
  })
  .or(z.undefined())
  .default(false);

const ChatProviderSchema = z.enum(['openai', 'lmstudio']).default('lmstudio');

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
  // ---- CHAT / LLM CONFIG (OpenAI or LM Studio) ----
  AI_PROVIDER: ChatProviderSchema.default('lmstudio'),
  AI_BASE_URL: UrlString.default('http://127.0.0.1:1234').optional(),

  AI_OPENAI_MODEL_1: z.string().min(1).default('gpt-4-turbo-preview'),
  AI_OPENAI_MODEL_2: z.string().optional(),
  AI_OPENAI_MODEL_3: z.string().optional(),

  AI_LOCAL_MODEL_1: z.string().min(1).default('llama-3.1-8b-lexi-uncensored-v2'),
  AI_LOCAL_MODEL_2: z.string().optional(),
  AI_LOCAL_MODEL_3: z.string().optional(),

  AI_TEMPERATURE: z.coerce.number().min(0).max(2).optional(),
  AI_CHAT_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(2000),
  AI_CHAT_MAX_DURATION: z.coerce.number().int().positive().default(30),

  OPENAI_API_KEY: z.string().optional(),
});

const processedEnv = Object.fromEntries(
  Object.entries(process.env).map(([k, v]) => [k, v === '' ? undefined : v]),
);

function normalizeV1BaseURL(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

function getModelByIndex(models: string[], oneBasedIndex: number): string {
  const i = Math.max(0, Math.min(oneBasedIndex - 1, models.length - 1));
  return models[i];
}

const validate = () => {
  const parsed = schema.safeParse(processedEnv);
  if (!parsed.success) {
    console.error('AI test env validation failed:', parsed.error.format());
    throw new Error('AI test env validation failed. See logs for details.');
  }

  const env = parsed.data;
  const errors: string[] = [];

  if (env.AI_PROVIDER === 'openai') {
    if (!env.OPENAI_API_KEY) errors.push('OPENAI_API_KEY is required when AI_PROVIDER=openai');
    if (!env.AI_OPENAI_MODEL_1) errors.push('AI_OPENAI_MODEL_1 is required when AI_PROVIDER=openai');
  } else if (env.AI_PROVIDER === 'lmstudio') {
    if (!env.AI_BASE_URL) errors.push('AI_BASE_URL is required when AI_PROVIDER=lmstudio');
    if (!env.AI_LOCAL_MODEL_1) errors.push('AI_LOCAL_MODEL_1 is required when AI_PROVIDER=lmstudio');
  }

  if (errors.length) {
    const msg = `AI test configuration errors:\n${errors.join('\n')}`;
    console.error(msg);
    throw new Error(msg);
  }

  const provider = env.AI_PROVIDER;

  const baseUrl =
    provider === 'lmstudio'
      ? env.AI_BASE_URL
        ? normalizeV1BaseURL(env.AI_BASE_URL)
        : normalizeV1BaseURL('http://127.0.0.1:1234')
      : undefined;

  const openaiModels: string[] = [];
  if (env.AI_OPENAI_MODEL_1) openaiModels.push(env.AI_OPENAI_MODEL_1);
  if (env.AI_OPENAI_MODEL_2) openaiModels.push(env.AI_OPENAI_MODEL_2);
  else if (openaiModels.length > 0) openaiModels.push(openaiModels[0]);
  if (env.AI_OPENAI_MODEL_3) openaiModels.push(env.AI_OPENAI_MODEL_3);
  else if (openaiModels.length > 0) openaiModels.push(openaiModels[openaiModels.length - 1]);

  const localModels: string[] = [];
  if (env.AI_LOCAL_MODEL_1) localModels.push(env.AI_LOCAL_MODEL_1);
  if (env.AI_LOCAL_MODEL_2) localModels.push(env.AI_LOCAL_MODEL_2);
  else if (localModels.length > 0) localModels.push(localModels[0]);
  if (env.AI_LOCAL_MODEL_3) localModels.push(env.AI_LOCAL_MODEL_3);
  else if (localModels.length > 0) localModels.push(localModels[localModels.length - 1]);

  const models = provider === 'openai' ? openaiModels : localModels;
  const modelName = models[0];

  return {
    provider: provider as 'openai' | 'lmstudio',
    models,
    modelName,
    getModel: (index: number) => getModelByIndex(models, index),
    baseUrl,
    temperature: env.AI_TEMPERATURE,
    limits: {
      maxOutputTokens: env.AI_CHAT_MAX_OUTPUT_TOKENS,
      maxDurationSec: env.AI_CHAT_MAX_DURATION,
    },
    secrets: {
      openaiApiKey: env.OPENAI_API_KEY,
    },
  };
};

export const aiServerConfig = Object.freeze(validate());
export type AiServerTestConfig = typeof aiServerConfig;
