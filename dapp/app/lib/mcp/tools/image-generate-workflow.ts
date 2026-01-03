// dapp/app/lib/mcp/tools/image-generate-workflow.ts
//
// Private client delivery (no server storage, no base64 in chat text):
// - TEXT: <img src="store://image/<name>" alt="..." width="W" height="H" />
// - JSON (SSE only): { kind:'store-image', name, mime, width, height, alt, dataBase64 }

import { createLogger } from '@logger';
import type { Tool } from '../../../schemas/domain/tool';
import { createTool, jsonResult, textResult } from './types';
import { aiServerConfig } from '@config/ai.server';
import { errorResultShape, fail } from './tool-errors';
import type { ToolInputMap } from '../generated/tool-catalog-types';

const logger = createLogger('tool:image-workflow');

// Prefer generated tool typings if present; otherwise fall back to local shape.
type GeneratedParams = ToolInputMap extends { ['generate_image_with_alt']: infer T } ? T : never;
type FallbackParams = { prompt: string; name?: string };
type Params = [GeneratedParams] extends [never] ? FallbackParams : GeneratedParams;

const InputSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    prompt: { type: 'string', description: 'Natural language prompt for image generation' },
    name: { type: 'string', description: 'Optional preferred name (will be normalized/uniquified)' },
  },
  required: ['prompt'],
};

function uniqueName(base?: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const rand = Math.random().toString(36).slice(2, 8);
  const safe = (base || `img_${ts}_${rand}`).toLowerCase().replace(/[^a-z0-9_\-]/g, '-');
  return safe.endsWith('.png') ? safe : `${safe}.png`;
}

type SizeStr = '256x256' | '512x512' | '1024x1024';
type Quality = 'low' | 'medium' | 'high';

// Parse "1024x1024" -> { w,h,size }, allowlist sizes
function parseEnvSize(sizeStr?: string): { w: number; h: number; size: SizeStr } {
  const s = (sizeStr || '512x512').trim().toLowerCase();
  const allowed: Record<SizeStr, true> = { '256x256': true, '512x512': true, '1024x1024': true };
  const use: SizeStr = (s in allowed ? (s as SizeStr) : '512x512');
  const [w, h] = use.split('x').map((n) => parseInt(n, 10));
  return { w, h, size: use };
}

// Pass-through quality expected by your endpoint: 'low' | 'medium' | 'high'
function resolveQuality(q?: string): Quality {
  const v = (q || '').toLowerCase();
  if (v === 'low' || v === 'medium' || v === 'high') return v;
  return 'medium';
}

async function fetchAsBase64(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch image URL failed ${r.status}`);
  const buf = await r.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

type ImageGenPayload = {
  model: string;
  prompt: string;
  size: SizeStr;
  quality: Quality;
  n: number;
};

async function callOpenAIImage(prompt: string): Promise<{ pngBase64: string; w: number; h: number }> {
  if (aiServerConfig.image.provider !== 'openai') {
    fail('AI_IMAGE_PROVIDER must be "openai" for this workflow');
  }
  const apiKey = aiServerConfig.image.openai.apiKey;
  const model = aiServerConfig.image.openai.model;
  if (!apiKey || !model) fail('OpenAI image API not configured');

  // Enforce size & quality from env only
  const { w, h, size } = parseEnvSize(aiServerConfig.image.defaults.size);
  const quality = resolveQuality(String(aiServerConfig.image.defaults.quality || ''));

  const payload: ImageGenPayload = {
    model,
    prompt,
    size,      // "256x256" | "512x512" | "1024x1024"
    quality,   // "low" | "medium" | "high"
    n: 1,
    // NOTE: do NOT send response_format; your backend 400s on it.
  };

  logger.info('[images:request]', { model, size, quality });

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text().catch(() => '');
  if (!res.ok) {
    let msg: string = text;
    try {
      const j = JSON.parse(text) as { error?: { message?: string } };
      msg = j?.error?.message || msg;
    } catch {}
    logger.error('[images:error]', { status: res.status, message: String(msg).slice(0, 400) });
    throw new Error(`Images API ${res.status}: ${msg}`);
  }

  // Accept either b64_json or url
  let b64: string | undefined;
  try {
    const json = JSON.parse(text) as { data?: Array<{ b64_json?: string; url?: string }> };
    const item = json?.data?.[0] || {};
    if (typeof item.b64_json === 'string' && item.b64_json.length > 0) {
      b64 = item.b64_json;
    } else if (typeof item.url === 'string' && item.url) {
      b64 = await fetchAsBase64(item.url);
    } else {
      throw new Error('Images API returned neither b64_json nor url');
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error('[images:parse-error]', { message, preview: text.slice(0, 200) });
    throw e instanceof Error ? e : new Error(message);
  }

  return { pngBase64: b64!, w, h };
}

/**
 * Alt-text generation now uses a provider-scoped "vision model":
 * - Provider = aiServerConfig.vision.provider (same as chat provider)
 * - Model     = aiServerConfig.vision.model (dedicated env per provider)
 */
async function generateAltText(dataUrl: string): Promise<string> {
  const provider = aiServerConfig.vision.provider;
  const model = aiServerConfig.vision.model;

  if (!model) {
    logger.warn('[alttext] vision model missing; falling back to generic text');
    return 'Generated image';
  }

  // Common request body (OpenAI-compatible)
  const body: {
    model: string;
    temperature: number;
    max_tokens: number;
    messages: Array<{
      role: 'system' | 'user';
      content:
        | string
        | Array<
            | { type: 'text'; text: string }
            | { type: 'image_url'; image_url: { url: string } }
          >;
    }>;
  } = {
    model,
    temperature: 0.2,
    max_tokens: 80,
    messages: [
      {
        role: 'system',
        content:
          'You produce concise, specific, screen-reader friendly alt text. Max 120 characters. No trailing period.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image in ≤120 characters.' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
  };

  try {
    if (provider === 'openai') {
      const apiKey = aiServerConfig.secrets.openaiApiKey;
      if (!apiKey) fail('OPENAI_API_KEY required for alt text step');

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const text = await res.text().catch(() => '');
      if (!res.ok) {
        let msg: string = text;
        try {
          const j = JSON.parse(text) as { error?: { message?: string } };
          msg = j?.error?.message || msg;
        } catch {}
        logger.warn('[alttext:error]', { status: res.status, message: String(msg).slice(0, 400) });
        return 'Generated image';
      }

      try {
        const json = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }> };
        const content = json?.choices?.[0]?.message?.content ?? '';
        const alt = String(content || '').replace(/\s+/g, ' ').trim();
        return alt || 'Generated image';
      } catch {
        return 'Generated image';
      }
    }

    // lmstudio path (OpenAI-compatible API at configured baseURL)
    if (provider === 'lmstudio') {
      const base = aiServerConfig.baseUrl;
      if (!base) fail('AI_BASE_URL required for LM Studio alt text step');

      const url = `${base}/chat/completions`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // LM Studio usually ignores Authorization; omit unless configured to require it.
        body: JSON.stringify(body),
      });

      const text = await res.text().catch(() => '');
      if (!res.ok) {
        logger.warn('[alttext:error:lmstudio]', { status: res.status, preview: text.slice(0, 400) });
        return 'Generated image';
      }

      try {
        const json = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }> };
        const content = json?.choices?.[0]?.message?.content ?? '';
        const alt = String(content || '').replace(/\s+/g, ' ').trim();
        return alt || 'Generated image';
      } catch {
        return 'Generated image';
      }
    }

    // Unknown provider (should not happen given schema)
    logger.warn('[alttext] unsupported provider', { provider });
    return 'Generated image';
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('[alttext:exception]', { message });
    return 'Generated image';
  }
}

const toolDef: Tool<Params> = {
  name: 'generate_image_with_alt',
  description:
    'Generate an image from a text prompt (OpenAI), derive alt text via vision, and return an <img src="store://image/..."> tag. Image bytes are sent out-of-band in tool JSON.',
  inputSchema: InputSchema,

  async handler(params: Params) {
    try {
      const prompt = String((params as { prompt?: unknown })?.prompt ?? '').trim();
      if (!prompt) fail('Missing prompt');

      const name = uniqueName((params as { name?: unknown })?.name as string | undefined);

      const { pngBase64, w, h } = await callOpenAIImage(prompt);

      // Data URL is used ONLY for alt text; never sent in assistant text.
      const dataUrlForVision = `data:image/png;base64,${pngBase64}`;
      const alt = await generateAltText(dataUrlForVision);

      // TEXT for the model/chat: clean, no base64, width/height from env size ONLY.
      const html = `<img src="store://image/${name}" alt="${alt.replace(/"/g, '&quot;')}" width="${w}" height="${h}" />`;

      // JSON for the tool channel: carries the pixels for client-side store.
      const json = jsonResult({
        kind: 'store-image',
        name,
        mime: 'image/png',
        width: w,
        height: h,
        alt,
        dataBase64: pngBase64,
      });

      const text = textResult(html);
      return { content: [...json.content, ...text.content] };
    } catch (err: unknown) {
      // Respect explicit tool failures; otherwise surface a concise message.
      if (
        typeof err === 'object' &&
        err !== null &&
        'isToolFailure' in err &&
        (err as { isToolFailure?: unknown }).isToolFailure
      ) {
        const message = (err as { message?: unknown }).message;
        return errorResultShape(String(message ?? 'Tool failure'));
      }
      const msg = err instanceof Error ? err.message : String(err);
      return errorResultShape(`Failed to generate image: ${msg}`);
    }
  },
};

export default createTool(toolDef);
