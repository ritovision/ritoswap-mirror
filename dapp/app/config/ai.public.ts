// app/config/ai.public.ts
// ✅ Safe to import in both client and server components.
// Public (NEXT_PUBLIC_*) AI/chat flags only.

import { z } from 'zod';

// ---- RUN-ONCE GUARD (ambient declaration) ----
declare global {
  var __AI_PUBLIC_ENV_LOGGED__: boolean | undefined;
}

// Strict boolean parser for env flags (same behavior as public.env.ts)
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

const schema = z.object({
  // 🔐 Policy flag: UI + client decides whether to attach Authorization header.
  NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT: BoolEnv.default(false),

  // Where the client should POST chat messages.
  NEXT_PUBLIC_AI_CHAT_API_PATH: z.string().min(1).default('/api/chat'),
});

// Read only the keys we care about (avoid leaking the whole process.env)
const raw = {
  NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT: process.env.NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT,
  NEXT_PUBLIC_AI_CHAT_API_PATH: process.env.NEXT_PUBLIC_AI_CHAT_API_PATH,
};

const validate = () => {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    // Fill with schema defaults if validation fails; log once on server.
    if (typeof window === 'undefined' && !globalThis.__AI_PUBLIC_ENV_LOGGED__) {
      console.error('AI public env validation issues:', parsed.error.format());
      globalThis.__AI_PUBLIC_ENV_LOGGED__ = true;
    }
    return schema.parse({});
  }

  const env = parsed.data;

  // Optional one-time diagnostics (server only)
  if (typeof window === 'undefined' && !globalThis.__AI_PUBLIC_ENV_LOGGED__) {
    console.log(
      `[ai.public] Chat API path: ${env.NEXT_PUBLIC_AI_CHAT_API_PATH} | JWT required: ${
        env.NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT ? 'yes' : 'no'
      }`,
    );
    globalThis.__AI_PUBLIC_ENV_LOGGED__ = true;
  }

  return env;
};

export const aiPublicEnv = Object.freeze(validate());
export type AiPublicEnv = typeof aiPublicEnv;

// Small convenience wrapper for consumers
export const aiPublicConfig = Object.freeze({
  requiresJwt: aiPublicEnv.NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT,
  apiPath: aiPublicEnv.NEXT_PUBLIC_AI_CHAT_API_PATH,
});
export type AiPublicConfig = typeof aiPublicConfig;
