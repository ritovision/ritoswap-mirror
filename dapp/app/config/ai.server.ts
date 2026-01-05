// app/config/ai.server.ts
// ⚠️ Server-only AI/chat configuration (secrets & server behavior).
// Do NOT import this from client components or "use client" files.

import 'server-only';
import { z } from 'zod';
import { createLogger } from '@logger';
import { aiPublicConfig } from './ai.public';
import { serverConfig } from './server.env';

const logger = createLogger('ai.server');

// ---- RUN-ONCE GUARD (ambient declaration) ----
declare global {
  var __AI_SERVER_ENV_LOGGED__: boolean | undefined;
}

// Shared boolean coercion
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

// Chat provider schema (unchanged): OpenAI or LM Studio
const ChatProviderSchema = z.enum(['openai', 'lmstudio']).default('lmstudio');

// Custom URL validator (avoiding deprecated .url())
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

const ImageQuality = z.enum(['low', 'medium', 'high']).default('medium');

// Image provider schema (NO lmstudio here)
const ImageProviderSchema = z.enum(['openai', 'replicate', 'huggingface']).default('openai');

const schema = z.object({
  // ---- CHAT / LLM CONFIG (OpenAI or LM Studio) ----
  AI_PROVIDER: ChatProviderSchema.default('lmstudio'),
  AI_BASE_URL: UrlString.default('http://127.0.0.1:1234').optional(),

  // Multiple chat models per provider
  AI_OPENAI_MODEL_1: z.string().min(1).default('gpt-4-turbo-preview'),
  AI_OPENAI_MODEL_2: z.string().optional(),
  AI_OPENAI_MODEL_3: z.string().optional(),

  AI_LOCAL_MODEL_1: z.string().min(1).default('llama-3.1-8b-lexi-uncensored-v2'),
  AI_LOCAL_MODEL_2: z.string().optional(),
  AI_LOCAL_MODEL_3: z.string().optional(),

  // NEW: provider-scoped vision model (used for multimodal/alt-text; same provider as chat)
  AI_OPENAI_VISION_MODEL: z.string().optional(), // e.g., "gpt-4o-mini"
  AI_LOCAL_VISION_MODEL: z.string().optional(),  // e.g., "llama-3.2-vision:latest"

  // Temperature (optional - only used if set)
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).optional(),

  // Limits
  AI_CHAT_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(2000),
  AI_CHAT_MAX_DURATION: z.coerce.number().int().positive().default(30),

  // Chat token quota (kept for future)
  AI_CHAT_QUOTA_ENABLED: BoolEnv.default(false),
  AI_CHAT_QUOTA_TOKENS: z.coerce.number().int().positive().default(20_000),
  AI_CHAT_QUOTA_WINDOW_SEC: z.coerce.number().int().positive().default(86_400),

  // ---- Crypto quota controls ----
  AI_CRYPTO_QUOTA: BoolEnv.default(true),
  AI_CRYPTO_QUOTA_DAILY_LIMIT: z.coerce.number().nonnegative().default(0), // ETH; 0 = no cap
  AI_CRYPTO_QUOTA_USER_LIMIT: z.coerce.number().nonnegative().default(0),  // ETH; 0 = no cap
  AI_CRYPTO_QUOTA_DURATION: z.coerce.number().int().positive().default(86_400),

  // Secrets
  OPENAI_API_KEY: z.string().optional(),
  AI_PRIVATE_KEY: z.string().optional(),        // send-crypto tool
  AI_QUOTA_RESET_SECRET: z.string().optional(), // admin backdoor

  // ---- IMAGE GENERATION CONFIG (OpenAI | Replicate | Hugging Face) ----
  AI_IMAGE_PROVIDER: ImageProviderSchema.default('openai'),

  // OpenAI image model (e.g., gpt-image-1)
  OPENAI_IMAGE_MODEL: z.string().default('gpt-image-1'),
  // Optional override for image API key (falls back to OPENAI_API_KEY if undefined)
  OPENAI_IMAGE_API_KEY: z.string().optional(),

  // Replicate
  REPLICATE_API_TOKEN: z.string().optional(),

  // Hugging Face
  HUGGINGFACE_API_TOKEN: z.string().optional(),
  HUGGINGFACE_IMAGE_MODEL: z.string().optional(), // e.g., "stabilityai/sdxl-turbo"
  // Optional base URL (use HF Inference API by default; per-endpoint URLs can be set in adapter if needed)
  HUGGINGFACE_BASE_URL: UrlString.default('https://api-inference.huggingface.co').optional(),

  // Defaults for generation
  IMAGE_DEFAULT_SIZE: z.string().regex(/^\d+x\d+$/).default('1024x1024'), // e.g., 1024x1024
  IMAGE_DEFAULT_QUALITY: ImageQuality.default('medium'),
  IMAGE_MAX_CONCURRENCY: z.coerce.number().int().positive().default(4), // Worker concurrency for generation
  IMAGE_MAX_DURATION: z.coerce.number().int().positive().default(60),   // seconds
});

// Preprocess env (empty string → undefined)
const processedEnv = Object.fromEntries(
  Object.entries(process.env).map(([k, v]) => [k, v === '' ? undefined : v]),
);

function normalizeV1BaseURL(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

const validate = () => {
  const parsed = schema.safeParse(processedEnv);
  if (!parsed.success) {
    const details = parsed.error.format();
    logger.error('AI server env validation failed:', details);
    throw new Error('AI server env validation failed. See logs for details.');
  }

  const env = parsed.data;

  // ---- Conditional validations (CHAT) ----
  const errors: string[] = [];

  if (env.AI_PROVIDER === 'openai') {
    if (!env.OPENAI_API_KEY) errors.push('OPENAI_API_KEY is required when AI_PROVIDER=openai');
    if (!env.AI_OPENAI_MODEL_1) errors.push('AI_OPENAI_MODEL_1 is required when AI_PROVIDER=openai');
  } else if (env.AI_PROVIDER === 'lmstudio') {
    if (!env.AI_BASE_URL) errors.push('AI_BASE_URL is required when AI_PROVIDER=lmstudio');
    if (!env.AI_LOCAL_MODEL_1) errors.push('AI_LOCAL_MODEL_1 is required when AI_PROVIDER=lmstudio');
  }

  // ---- Conditional validations (IMAGE) ----
  if (env.AI_IMAGE_PROVIDER === 'openai') {
    const imageKey = env.OPENAI_IMAGE_API_KEY ?? env.OPENAI_API_KEY;
    if (!imageKey) errors.push('OPENAI_IMAGE_API_KEY or OPENAI_API_KEY is required when AI_IMAGE_PROVIDER=openai');
    if (!env.OPENAI_IMAGE_MODEL) errors.push('OPENAI_IMAGE_MODEL is required when AI_IMAGE_PROVIDER=openai');
  }

  if (env.AI_IMAGE_PROVIDER === 'replicate') {
    if (!env.REPLICATE_API_TOKEN) errors.push('REPLICATE_API_TOKEN is required when AI_IMAGE_PROVIDER=replicate');
    // Model selection is done in the adapter for Replicate (since each call names the model/version)
  }

  if (env.AI_IMAGE_PROVIDER === 'huggingface') {
    if (!env.HUGGINGFACE_API_TOKEN) errors.push('HUGGINGFACE_API_TOKEN is required when AI_IMAGE_PROVIDER=huggingface');
    if (!env.HUGGINGFACE_IMAGE_MODEL) errors.push('HUGGINGFACE_IMAGE_MODEL is required when AI_IMAGE_PROVIDER=huggingface');
    // HUGGINGFACE_BASE_URL is optional; default points at the generic Inference API host.
  }

  if (errors.length) {
    const msg = `AI configuration errors:\n${errors.join('\n')}`;
    logger.error(msg);
    throw new Error(msg);
  }

  // ---- Derived & normalized values (CHAT) ----
  const provider = env.AI_PROVIDER;

  const baseUrl =
    provider === 'lmstudio'
      ? env.AI_BASE_URL
        ? normalizeV1BaseURL(env.AI_BASE_URL)
        : normalizeV1BaseURL('http://127.0.0.1:1234')
      : undefined;

  // Build models array with fallback logic (chat models)
  const openaiModels: string[] = [];
  if (env.AI_OPENAI_MODEL_1) openaiModels.push(env.AI_OPENAI_MODEL_1);
  if (env.AI_OPENAI_MODEL_2) openaiModels.push(env.AI_OPENAI_MODEL_2);
  else if (openaiModels.length > 0) openaiModels.push(openaiModels[0]); // Fallback to model 1
  if (env.AI_OPENAI_MODEL_3) openaiModels.push(env.AI_OPENAI_MODEL_3);
  else if (openaiModels.length > 0) openaiModels.push(openaiModels[openaiModels.length - 1]); // Fallback to previous

  const localModels: string[] = [];
  if (env.AI_LOCAL_MODEL_1) localModels.push(env.AI_LOCAL_MODEL_1);
  if (env.AI_LOCAL_MODEL_2) localModels.push(env.AI_LOCAL_MODEL_2);
  else if (localModels.length > 0) localModels.push(localModels[0]); // Fallback to model 1
  if (env.AI_LOCAL_MODEL_3) localModels.push(env.AI_LOCAL_MODEL_3);
  else if (localModels.length > 0) localModels.push(localModels[localModels.length - 1]); // Fallback to previous

  const models = provider === 'openai' ? openaiModels : localModels;

  // ---- Derived vision model (provider-scoped) ----
  const visionModel =
    provider === 'openai'
      ? (env.AI_OPENAI_VISION_MODEL || env.AI_OPENAI_MODEL_1) // default fallback to primary chat model
      : (env.AI_LOCAL_VISION_MODEL || env.AI_LOCAL_MODEL_1);  // default fallback to primary chat model

  // ---- Derived & normalized values (IMAGE) ----
  const effectiveOpenAiImageKey = (env.OPENAI_IMAGE_API_KEY ?? env.OPENAI_API_KEY) as string | undefined;

  const stateWorkerActive = serverConfig.stateService.isActive;

  // Quota activation (simplified for now)
  const quotaActive = false; // Disabled as requested

  // Backdoor reset
  const quotaResetSecret = (env.AI_QUOTA_RESET_SECRET ?? '').trim();
  const quotaResetEnabled = quotaResetSecret.length > 0;

  if (!globalThis.__AI_SERVER_ENV_LOGGED__) {
    logger.debug(
      `AI provider=${provider} models=[${models.join(', ')}] baseUrl=${baseUrl ?? '<n/a>'} ` +
        `maxTokens=${env.AI_CHAT_MAX_OUTPUT_TOKENS} maxDuration=${env.AI_CHAT_MAX_DURATION}s` +
        (env.AI_TEMPERATURE !== undefined ? ` temperature=${env.AI_TEMPERATURE}` : ''),
    );
    logger.debug(`Vision model=${visionModel}`);
    if (provider === 'openai') {
      logger.debug(`OpenAI key present: ${env.OPENAI_API_KEY ? 'yes' : 'no'}`);
    }
    logger.debug(
      `Image provider=${env.AI_IMAGE_PROVIDER} ` +
        `openaiModel=${env.OPENAI_IMAGE_MODEL ?? '<n/a>'} ` +
        `hfModel=${env.HUGGINGFACE_IMAGE_MODEL ?? '<n/a>'} ` +
        `hfBase=${env.HUGGINGFACE_BASE_URL ?? '<n/a>'}`,
    );
    globalThis.__AI_SERVER_ENV_LOGGED__ = true;
  }

  return {
    // Raw (validated)
    AI_PROVIDER: provider,
    AI_BASE_URL: baseUrl,
    AI_OPENAI_MODEL_1: env.AI_OPENAI_MODEL_1,
    AI_OPENAI_MODEL_2: env.AI_OPENAI_MODEL_2,
    AI_OPENAI_MODEL_3: env.AI_OPENAI_MODEL_3,
    AI_LOCAL_MODEL_1: env.AI_LOCAL_MODEL_1,
    AI_LOCAL_MODEL_2: env.AI_LOCAL_MODEL_2,
    AI_LOCAL_MODEL_3: env.AI_LOCAL_MODEL_3,

    // Vision raw envs
    AI_OPENAI_VISION_MODEL: env.AI_OPENAI_VISION_MODEL,
    AI_LOCAL_VISION_MODEL: env.AI_LOCAL_VISION_MODEL,

    AI_TEMPERATURE: env.AI_TEMPERATURE,
    AI_CHAT_MAX_OUTPUT_TOKENS: env.AI_CHAT_MAX_OUTPUT_TOKENS,
    AI_CHAT_MAX_DURATION: env.AI_CHAT_MAX_DURATION,
    AI_CHAT_QUOTA_ENABLED: env.AI_CHAT_QUOTA_ENABLED,
    AI_CHAT_QUOTA_TOKENS: env.AI_CHAT_QUOTA_TOKENS,
    AI_CHAT_QUOTA_WINDOW_SEC: env.AI_CHAT_QUOTA_WINDOW_SEC,
    OPENAI_API_KEY: env.OPENAI_API_KEY,

    // Crypto / secrets
    AI_PRIVATE_KEY: env.AI_PRIVATE_KEY,
    AI_CRYPTO_QUOTA: env.AI_CRYPTO_QUOTA,
    AI_CRYPTO_QUOTA_DAILY_LIMIT: env.AI_CRYPTO_QUOTA_DAILY_LIMIT,
    AI_CRYPTO_QUOTA_USER_LIMIT: env.AI_CRYPTO_QUOTA_USER_LIMIT,
    AI_CRYPTO_QUOTA_DURATION: env.AI_CRYPTO_QUOTA_DURATION,

    // Image raw envs
    AI_IMAGE_PROVIDER: env.AI_IMAGE_PROVIDER,
    OPENAI_IMAGE_MODEL: env.OPENAI_IMAGE_MODEL,
    OPENAI_IMAGE_API_KEY: effectiveOpenAiImageKey,
    REPLICATE_API_TOKEN: env.REPLICATE_API_TOKEN,
    HUGGINGFACE_API_TOKEN: env.HUGGINGFACE_API_TOKEN,
    HUGGINGFACE_IMAGE_MODEL: env.HUGGINGFACE_IMAGE_MODEL,
    HUGGINGFACE_BASE_URL: env.HUGGINGFACE_BASE_URL,
    IMAGE_DEFAULT_SIZE: env.IMAGE_DEFAULT_SIZE,
    IMAGE_DEFAULT_QUALITY: env.IMAGE_DEFAULT_QUALITY,
    IMAGE_MAX_CONCURRENCY: env.IMAGE_MAX_CONCURRENCY,
    IMAGE_MAX_DURATION: env.IMAGE_MAX_DURATION,

    // Derived
    models,
    modelName: models[0], // Default to first model for backward compatibility
    baseUrl,
    temperature: env.AI_TEMPERATURE,
    requiresJwt: aiPublicConfig.requiresJwt,
    stateWorkerActive,
    quotaActive,

    // Vision derived
    visionModel,

    // Backdoor reset
    quotaResetEnabled,
    quotaResetSecret,
  } as const;
};

export const aiServerEnv = Object.freeze(validate());
export type AiServerEnv = typeof aiServerEnv;

// Helper function to get model by index (1-based)
export function getModelByIndex(index: number): string {
  const models = aiServerEnv.models;
  // Convert 1-based index to 0-based, with bounds checking
  const arrayIndex = Math.max(0, Math.min(index - 1, models.length - 1));
  return models[arrayIndex];
}

// Ergonomic facade
export const aiServerConfig = Object.freeze({
  // Chat providers
  provider: aiServerEnv.AI_PROVIDER as 'openai' | 'lmstudio',
  models: aiServerEnv.models,
  modelName: aiServerEnv.modelName, // Back-compat
  getModel: getModelByIndex,
  baseUrl: aiServerEnv.baseUrl,
  temperature: aiServerEnv.temperature, // undefined if not set
  limits: {
    maxOutputTokens: aiServerEnv.AI_CHAT_MAX_OUTPUT_TOKENS,
    maxDurationSec: aiServerEnv.AI_CHAT_MAX_DURATION,
  },
  quota: {
    enabled: aiServerEnv.AI_CHAT_QUOTA_ENABLED,
    tokens: aiServerEnv.AI_CHAT_QUOTA_TOKENS,
    windowSec: aiServerEnv.AI_CHAT_QUOTA_WINDOW_SEC,
    active: aiServerEnv.quotaActive,
  },
  // ETH quota
  cryptoQuota: {
    enabled: aiServerEnv.AI_CRYPTO_QUOTA,
    dailyLimitEth: aiServerEnv.AI_CRYPTO_QUOTA_DAILY_LIMIT,
    perUserLimitEth: aiServerEnv.AI_CRYPTO_QUOTA_USER_LIMIT,
    durationSec: aiServerEnv.AI_CRYPTO_QUOTA_DURATION,
  },
  requiresJwt: aiServerEnv.requiresJwt,
  stateWorkerActive: aiServerEnv.stateWorkerActive,
  quotaReset: {
    enabled: aiServerEnv.quotaResetEnabled,
  },
  secrets: {
    openaiApiKey: aiServerEnv.OPENAI_API_KEY,
    quotaResetSecret: aiServerEnv.quotaResetSecret,
    aiPrivateKey: aiServerEnv.AI_PRIVATE_KEY,
  },

  // ---- IMAGE CONFIG FACADE ----
  image: {
    provider: aiServerEnv.AI_IMAGE_PROVIDER as 'openai' | 'replicate' | 'huggingface',
    // OpenAI
    openai: {
      model: aiServerEnv.OPENAI_IMAGE_MODEL,
      apiKey: aiServerEnv.OPENAI_IMAGE_API_KEY,
    },
    // Replicate
    replicate: {
      apiToken: aiServerEnv.REPLICATE_API_TOKEN,
    },
    // Hugging Face
    huggingface: {
      apiToken: aiServerEnv.HUGGINGFACE_API_TOKEN,
      model: aiServerEnv.HUGGINGFACE_IMAGE_MODEL,
      baseUrl: aiServerEnv.HUGGINGFACE_BASE_URL, // typically "https://api-inference.huggingface.co"
    },
    defaults: {
      size: aiServerEnv.IMAGE_DEFAULT_SIZE,
      quality: aiServerEnv.IMAGE_DEFAULT_QUALITY,
      maxConcurrency: aiServerEnv.IMAGE_MAX_CONCURRENCY,
      maxDurationSec: aiServerEnv.IMAGE_MAX_DURATION,
    },
    // Only providers that actually generate pixels should return true.
    supportsImageGeneration: ((): boolean => {
      switch (aiServerEnv.AI_IMAGE_PROVIDER) {
        case 'openai':
        case 'replicate':
        case 'huggingface':
          return true;
        default:
          return false;
      }
    })(),
  },

  // ---- VISION (ALT-TEXT) CONFIG FACADE ----
  vision: {
    // Uses the same provider as chat (OpenAI or LM Studio), but a dedicated model within that provider.
    provider: aiServerEnv.AI_PROVIDER as 'openai' | 'lmstudio',
    model: aiServerEnv.visionModel,
  },
} as const);

export type AiServerConfig = typeof aiServerConfig;
