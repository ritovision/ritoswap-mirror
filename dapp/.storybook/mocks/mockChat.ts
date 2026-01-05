import type { FetchHandler } from '../harnesses/FetchMock';
import { aiPublicConfig } from '@/app/config/ai.public';

export type MockRepeatMode = 'cycle' | 'random' | 'last';

export type MockToolCall = {
  toolName: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  startDelayMs?: number;
  outputDelayMs?: number;
  outputType?: 'available' | 'error';
};

export type MockChatResponse = {
  id?: string;
  text: string;
  chunks?: string[];
  delayMs?: number;
  chunkDelayMs?: number;
  toolCalls?: MockToolCall[];
  match?: RegExp | string;
};

export type MockChatScenario = {
  id: string;
  label: string;
  description?: string;
  responses: MockChatResponse[];
  repeat?: MockRepeatMode;
  fallback?: MockChatResponse;
  initialDelayMs?: number;
  chunkDelayMs?: number;
  maxChunkSize?: number;
  deferTextUntilTools?: boolean;
};

type MockChatSession = {
  index: number;
};

let responseSeq = 0;

const DEFAULT_DELAY_MS = 900;
const DEFAULT_CHUNK_DELAY_MS = 140;
const DEFAULT_MAX_CHUNK = 28;

const MOCK_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/Pq5G2QAAAABJRU5ErkJggg==';

const TOOL_OUTPUTS = {
  getEthBalance: {
    content: [
      { type: 'json', data: { balanceEth: '1.2389', symbol: 'ETH', chainName: 'Ethereum' } },
    ],
  },
  generateRapVerse: {
    content: [{ type: 'json', data: { round: 2 } }],
  },
  generateImage: {
    content: [
      {
        type: 'json',
        data: {
          kind: 'store-image',
          name: 'storybook-rito',
          mime: 'image/png',
          width: 256,
          height: 256,
          alt: 'Rito concept art',
          dataBase64: MOCK_IMAGE_BASE64,
        },
      },
    ],
  },
  keyNftRead: {
    content: [
      {
        type: 'json',
        data: {
          action: 'get_key_nft_summary_for_owner',
          owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          address: '0x1234567890abcdef1234567890abcdef12345678',
          tokenIds: ['101', '202'],
          tokens: [
            {
              tokenId: '101',
              colors: { backgroundColor: '#0d1117', keyColor: '#f97316' },
            },
          ],
        },
      },
    ],
  },
  keyNftManage: {
    content: [
      {
        type: 'json',
        data: {
          action: 'mint',
          tokenId: '404',
          burnedTokenId: '222',
          colors: { backgroundColor: '#0b1b2b', keyColor: '#22d3ee' },
          timeline: [
            { phase: 'burn', message: 'Burned previous key' },
            { phase: 'mint', message: 'Minted new key' },
            { phase: 'result', message: 'Key ready' },
          ],
        },
      },
    ],
  },
  keyNftUsedCount: {
    content: [{ type: 'json', data: { total: 57 } }],
  },
  markKeyUsed: {
    content: [
      {
        type: 'json',
        data: {
          tokenId: 777,
          chainName: 'RitoNet',
          address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          usedAt: '2024-01-30T20:01:02.000Z',
        },
      },
    ],
  },
  pineconeSearch: {
    content: [
      {
        type: 'json',
        data: {
          query: 'rap battle training data',
          index: 'rito-knowledge',
          namespace: 'rapbot',
          totalMatches: 12,
          topK: 5,
          matches: [{ score: 0.932, metadata: { title: 'Rito battle guide' } }],
        },
      },
    ],
  },
  sendCrypto: {
    content: [
      {
        type: 'json',
        data: {
          amountEth: 0.42,
          to: '0x7F5f4552091A69125d5DfCb7b8C2659029395Bdf',
          networkName: 'Ethereum',
        },
      },
    ],
  },
  sendCryptoAgent: {
    content: [
      {
        type: 'json',
        data: {
          decision: 'send',
          sentAmountEth: 0.09,
          to: '0x123400000000000000000000000000000000cafe',
          chainName: 'Base',
        },
      },
    ],
  },
};

export const mockChatScenarios: Record<string, MockChatScenario> = {
  default: {
    id: 'default',
    label: 'Default RapBot Reply',
    description: 'Conversational reply with a follow-up line.',
    responses: [
      {
        text:
          'Yo! Drop the topic and I will spin something sharp.\n\nFollow-up: want it hype or laid-back?',
      },
      {
        text:
          'Bars loaded. Give me a vibe, a chain, or a villain.\n\nFollow-up: should I flex, roast, or teach?',
      },
    ],
    repeat: 'cycle',
  },
  inlineGif: {
    id: 'inlineGif',
    label: 'Inline GIF',
    responses: [
      {
        text:
          'Reaction time:\n<gif src="https://media1.tenor.com/m/mFxdMmWsRikAAAAd/dogecoin-tweet-dogecoin.gif" width="320" alt="Dogecoin tweet" />',
      },
      {
        text:
          'Feeling the doge:\n<gif src="https://media1.tenor.com/m/oUBstqaKvYQAAAAd/dogecoin-doge.gif" width="300" alt="Doge" />',
      },
      {
        text:
          'Noted:\n<gif src="https://media1.tenor.com/m/-9Gb0lDJbzQAAAAd/dogecoin-notkdk3.gif" width="320" alt="Dogecoin reaction" />',
      },
      {
        text:
          'Good morning:\n<gif src="https://media1.tenor.com/m/uCp62jbo-OEAAAAd/good-morning.gif" width="320" alt="Good morning" />',
      },
      {
        text:
          'Stan energy:\n<gif src="https://media1.tenor.com/m/Mi7q91b9ppEAAAAd/nbgetsme-stan-twitter.gif" width="320" alt="Stan twitter" />',
      },
    ],
    repeat: 'random',
  },
  inlineImage: {
    id: 'inlineImage',
    label: 'Inline Image',
    responses: [
      {
        text:
          'Fresh visual dropped:\n<img src="/images/utilities/imageQuote/Bitcoin.jpg" alt="Bitcoin quote" width="260" height="200" />',
      },
      {
        text:
          'Chef mode:\n<img src="/images/utilities/imageQuote/Chefs.jpg" alt="Chef quote" width="260" height="200" />',
      },
      {
        text:
          'Foundation check:\n<img src="/images/utilities/imageQuote/Foundations.png" alt="Foundations quote" width="260" height="200" />',
      },
      {
        text:
          'Product vibes:\n<img src="/images/utilities/imageQuote/Product.jpg" alt="Product quote" width="260" height="200" />',
      },
      {
        text:
          'Roadmap mood:\n<img src="/images/utilities/imageQuote/Roadmap.jpg" alt="Roadmap quote" width="260" height="200" />',
      },
    ],
    repeat: 'random',
  },
  inlineSvg: {
    id: 'inlineSvg',
    label: 'Inline SVG',
    responses: [
      {
        text:
          'SVG flex:\n<svg viewBox="0 0 140 80" width="240" height="120"><rect x="0" y="0" width="140" height="80" fill="#0f172a"/><text x="70" y="45" fill="#38bdf8" text-anchor="middle" font-size="16">Rito SVG</text></svg>',
      },
      {
        text:
          'Chain pulse:\n<svg viewBox="0 0 160 90" width="260" height="140"><rect x="0" y="0" width="160" height="90" fill="#111827"/><circle cx="35" cy="45" r="22" fill="#22d3ee"/><text x="105" y="52" fill="#facc15" text-anchor="middle" font-size="14">Chain Pulse</text></svg>',
      },
      {
        text:
          'Waveform:\n<svg viewBox="0 0 180 100" width="280" height="140"><rect x="0" y="0" width="180" height="100" fill="#0b1220"/><path d="M20 70 L60 30 L100 70 L140 30 L160 50" stroke="#38bdf8" stroke-width="6" fill="none"/><text x="90" y="90" fill="#e2e8f0" text-anchor="middle" font-size="12">Waveform</text></svg>',
      },
    ],
    repeat: 'random',
  },
  inlineChainLogo: {
    id: 'inlineChainLogo',
    label: 'Inline Chain Logo',
    responses: [
      {
        text: 'Chain check:\n<chain-logo chainName="Ethereum" size="64" />',
      },
      {
        text: 'Layer vibes:\n<chain-logo chainName="Polygon" size="56" />',
      },
      {
        text: 'Rollup energy:\n<chain-logo chainName="Arbitrum" size="72" />',
      },
      {
        text: 'Base mode:\n<chain-logo chainName="Base" size="60" />',
      },
      {
        text: 'Doge mood:\n<chain-logo chainName="Doge" size="80" />',
      },
    ],
    repeat: 'random',
  },
  inlineLink: {
    id: 'inlineLink',
    label: 'Inline Link',
    responses: [
      {
        text: 'Peep the docs: [Rito Swap](https://ritoswap.com)',
      },
    ],
  },
  inlineKeyNft: {
    id: 'inlineKeyNft',
    label: 'Inline Key NFT',
    responses: [
      {
        text:
          'Key NFT preview:\n<key-nft bgColor="#0b1220" keyColor="#22d3ee" width="240" height="120" />',
      },
      {
        text:
          'Key NFT glow:\n<key-nft bgColor="#111827" keyColor="#f97316" width="240" height="120" />',
      },
      {
        text:
          'Key NFT flare:\n<key-nft bgColor="#1e293b" keyColor="#facc15" width="240" height="120" />',
      },
      {
        text:
          'Key NFT neon:\n<key-nft bgColor="#0f172a" keyColor="#38bdf8" width="240" height="120" />',
      },
    ],
    repeat: 'random',
  },
  inlineMusicPlay: {
    id: 'inlineMusicPlay',
    label: 'Inline Music Command',
    responses: [
      {
        text: 'Spinning up the beat:\n<music song="A-Trillie" action="play" />',
      },
    ],
  },
  inlineMusicRandom: {
    id: 'inlineMusicRandom',
    label: 'Random Music Controls',
    responses: [
      { text: 'Cue the hook:\n<music song="Altcoin_Love" action="play" />' },
      { text: 'Pause for the ad libs:\n<music action="pause" />' },
      { text: 'Jump to the drop:\n<music song="Hodeler" timeline="0:42" />' },
      { text: 'Toggle the vibe:\n<music action="toggle" />' },
    ],
    repeat: 'random',
  },
  inlineGoodbye: {
    id: 'inlineGoodbye',
    label: 'Inline Goodbye',
    responses: [
      {
        text: 'Mic drop. Goodbye!\n<goodbye seconds="6" />',
      },
    ],
  },
  toolGetBalance: {
    id: 'toolGetBalance',
    label: 'Tool: Get ETH Balance',
    responses: [
      {
        text: 'Checking balance now.',
        toolCalls: [
          {
            toolName: 'get_eth_balance',
            input: { chain: 'mainnet' },
            output: TOOL_OUTPUTS.getEthBalance,
            outputDelayMs: 1200,
          },
        ],
      },
    ],
  },
  toolGenerateRapVerse: {
    id: 'toolGenerateRapVerse',
    label: 'Tool: Generate Rap Verse',
    responses: [
      {
        text: 'Round two is on deck.',
        toolCalls: [
          {
            toolName: 'generate_rap_verse',
            input: { roundNumber: 2 },
            output: TOOL_OUTPUTS.generateRapVerse,
            outputDelayMs: 1500,
          },
        ],
      },
    ],
  },
  toolGenerateImage: {
    id: 'toolGenerateImage',
    label: 'Tool: Generate Image',
    responses: [
      {
        text: 'Rendering a visual:\n<img src="store://image/storybook-rito" alt="Rito visual" />',
        toolCalls: [
          {
            toolName: 'generate_image_with_alt',
            input: { prompt: 'Rito in neon city', size: 'square' },
            output: TOOL_OUTPUTS.generateImage,
            outputDelayMs: 1800,
          },
        ],
      },
    ],
  },
  toolKeyNftRead: {
    id: 'toolKeyNftRead',
    label: 'Tool: Key NFT Read',
    responses: [
      {
        text: 'Pulling key stats.',
        toolCalls: [
          {
            toolName: 'key_nft_read',
            input: { action: 'get_key_nft_summary_for_owner' },
            output: TOOL_OUTPUTS.keyNftRead,
            outputDelayMs: 1400,
          },
        ],
      },
    ],
  },
  toolKeyNftManage: {
    id: 'toolKeyNftManage',
    label: 'Tool: Key NFT Manage',
    responses: [
      {
        text: 'Handling key NFT transaction.',
        toolCalls: [
          {
            toolName: 'manage_key_nft',
            input: { action: 'mint' },
            output: TOOL_OUTPUTS.keyNftManage,
            outputDelayMs: 1600,
          },
        ],
      },
    ],
  },
  toolKeyNftUsedCount: {
    id: 'toolKeyNftUsedCount',
    label: 'Tool: Key NFT Used Count',
    responses: [
      {
        text: 'Counting used keys.',
        toolCalls: [
          {
            toolName: 'keynft_used_count',
            output: TOOL_OUTPUTS.keyNftUsedCount,
            outputDelayMs: 1200,
          },
        ],
      },
    ],
  },
  toolMarkKeyUsed: {
    id: 'toolMarkKeyUsed',
    label: 'Tool: Mark Key Used',
    responses: [
      {
        text: 'Marking key as used.',
        toolCalls: [
          {
            toolName: 'mark_key_used',
            input: { tokenId: 777 },
            output: TOOL_OUTPUTS.markKeyUsed,
            outputDelayMs: 1300,
          },
        ],
      },
    ],
  },
  toolPineconeSearch: {
    id: 'toolPineconeSearch',
    label: 'Tool: Pinecone Search',
    responses: [
      {
        text: 'Searching the knowledge base.',
        toolCalls: [
          {
            toolName: 'pinecone_search',
            input: { query: 'rap battle training data', index: 'rito-knowledge', namespace: 'rapbot' },
            output: TOOL_OUTPUTS.pineconeSearch,
            outputDelayMs: 1500,
          },
        ],
      },
    ],
  },
  toolSendCrypto: {
    id: 'toolSendCrypto',
    label: 'Tool: Send Crypto',
    responses: [
      {
        text: 'Sending crypto now.',
        toolCalls: [
          {
            toolName: 'send_crypto_to_signed_in_user',
            input: { amountEth: 0.42 },
            output: TOOL_OUTPUTS.sendCrypto,
            outputDelayMs: 1700,
          },
        ],
      },
    ],
  },
  toolSendCryptoAgent: {
    id: 'toolSendCryptoAgent',
    label: 'Tool: Send Crypto Agent',
    responses: [
      {
        text: 'Agent checking the request.',
        toolCalls: [
          {
            toolName: 'send_crypto_agent',
            input: { amountEth: 0.09 },
            output: TOOL_OUTPUTS.sendCryptoAgent,
            outputDelayMs: 1700,
          },
        ],
      },
    ],
  },
};

const CHAIN_LOGO_DIRS = [
  'ethereum',
  'sepolia',
  'polygon',
  'arbitrum',
  'base',
  'optimism',
  'avalanche',
  'fantom',
  'binance',
  'doge',
  'classic',
  'fetch',
];

function createChainLogoFetchHandler(): FetchHandler {
  return async (input, _init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.includes('api.github.com/repos/trustwallet/assets/contents/blockchains')) return undefined;

    const body = CHAIN_LOGO_DIRS.map((name) => ({ name, type: 'dir' }));
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

function normalizeUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function isChatRequest(input: RequestInfo | URL, init?: RequestInit, apiPath?: string) {
  const url = normalizeUrl(input);
  const method = (init?.method || 'POST').toUpperCase();
  const path = apiPath || aiPublicConfig.apiPath;
  return method === 'POST' && url.includes(path);
}

function parseBody(init?: RequestInit): unknown {
  if (!init?.body) return undefined;
  if (typeof init.body === 'string') {
    try {
      return JSON.parse(init.body);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function extractLatestUserText(payload: unknown): string {
  const body = payload as { messages?: unknown[] } | undefined;
  const messages = Array.isArray(body?.messages) ? (body?.messages as unknown[]) : [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i] as { role?: unknown; parts?: unknown[] };
    if (msg?.role !== 'user') continue;
    const parts = Array.isArray(msg.parts) ? msg.parts : [];
    const textPart = parts.find((p) => (p as { type?: string })?.type === 'text') as { text?: unknown } | undefined;
    if (textPart?.text && typeof textPart.text === 'string') return textPart.text;
    if (textPart?.text != null) return String(textPart.text);
  }
  return '';
}

function matchResponse(response: MockChatResponse, userText: string) {
  if (!response.match) return false;
  if (response.match instanceof RegExp) return response.match.test(userText);
  return userText.toLowerCase().includes(String(response.match).toLowerCase());
}

function pickResponse(
  scenario: MockChatScenario,
  session: MockChatSession,
  userText: string
): MockChatResponse {
  const matched = scenario.responses.find((response) => matchResponse(response, userText));
  if (matched) return matched;

  const list = scenario.responses;
  const mode = scenario.repeat ?? 'last';
  if (list.length === 0) {
    return scenario.fallback ?? { text: 'No mock response configured.' };
  }

  const idx = session.index;
  if (mode === 'random') {
    return list[Math.floor(Math.random() * list.length)];
  }
  if (mode === 'cycle') {
    return list[idx % list.length];
  }
  return list[Math.min(idx, list.length - 1)];
}

function nextIndex(scenario: MockChatScenario, session: MockChatSession) {
  if (scenario.responses.length === 0) return;
  session.index += 1;
}

function chunkText(text: string, maxChunkSize: number) {
  if (!text) return [''];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxChunkSize) {
    chunks.push(text.slice(i, i + maxChunkSize));
  }
  return chunks;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function encodeEvent(payload: unknown) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function encodeDone() {
  return 'data: [DONE]\n\n';
}

function buildToolCallEvents(
  toolCall: MockToolCall,
  toolCallId: string
) {
  const start = { type: 'tool-input-start', toolCallId, toolName: toolCall.toolName };
  const available = {
    type: 'tool-input-available',
    toolCallId,
    toolName: toolCall.toolName,
    input: toolCall.input ?? {},
  };

  if (toolCall.outputType === 'error' || toolCall.errorText) {
    const error = {
      type: 'tool-output-error',
      toolCallId,
      errorText: toolCall.errorText ?? 'Tool error',
    };
    return { start, available, output: error };
  }

  const output = {
    type: 'tool-output-available',
    toolCallId,
    output: toolCall.output ?? {},
  };
  return { start, available, output };
}

function createSseResponse({
  scenario,
  response,
  messageId,
}: {
  scenario: MockChatScenario;
  response: MockChatResponse;
  messageId: string;
}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enqueue = (text: string) => controller.enqueue(encoder.encode(text));

      (async () => {
        const delay = response.delayMs ?? scenario.initialDelayMs ?? DEFAULT_DELAY_MS;
        if (delay > 0) await sleep(delay);

        enqueue(encodeEvent({ type: 'start', messageId }));

        const toolOutputPromises: Promise<void>[] = [];
        const toolCalls = response.toolCalls ?? [];
        for (let i = 0; i < toolCalls.length; i += 1) {
          const toolCall = toolCalls[i];
          const toolCallId = `${messageId}-${toolCall.toolName}-${i + 1}`;
          const events = buildToolCallEvents(toolCall, toolCallId);
          if (toolCall.startDelayMs) await sleep(toolCall.startDelayMs);
          enqueue(encodeEvent(events.start));
          enqueue(encodeEvent(events.available));

          const outputDelay = toolCall.outputDelayMs ?? 0;
          toolOutputPromises.push(
            (async () => {
              if (outputDelay > 0) await sleep(outputDelay);
              enqueue(encodeEvent(events.output));
            })()
          );
        }

        const chunkDelay =
          response.chunkDelayMs ?? scenario.chunkDelayMs ?? DEFAULT_CHUNK_DELAY_MS;
        const maxChunkSize = scenario.maxChunkSize ?? DEFAULT_MAX_CHUNK;
        const chunks = response.chunks ?? chunkText(response.text, maxChunkSize);
        const textPartId = `text-${messageId}`;
        const deferTextUntilTools = Boolean(scenario.deferTextUntilTools);

        if (deferTextUntilTools && toolOutputPromises.length) {
          await Promise.all(toolOutputPromises);
        }

        enqueue(encodeEvent({ type: 'text-start', id: textPartId }));
        for (const chunk of chunks) {
          if (chunkDelay > 0) await sleep(chunkDelay);
          enqueue(encodeEvent({ type: 'text-delta', id: textPartId, delta: chunk }));
        }
        enqueue(encodeEvent({ type: 'text-end', id: textPartId }));

        if (!deferTextUntilTools && toolOutputPromises.length) {
          await Promise.all(toolOutputPromises);
        }

        enqueue(encodeEvent({ type: 'finish' }));
        enqueue(encodeDone());
        controller.close();
      })().catch((err) => {
        controller.error(err);
      });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
    },
  });
}

export function createChatFetchHandlers({
  scenario,
  apiPath,
  includeChainLogo = true,
}: {
  scenario: MockChatScenario;
  apiPath?: string;
  includeChainLogo?: boolean;
}): FetchHandler[] {
  const sessions = new Map<string, MockChatSession>();

  const chatHandler: FetchHandler = async (input, init) => {
    if (!isChatRequest(input, init, apiPath)) return undefined;

    const body = parseBody(init);
    const chatId = (body as { id?: string } | undefined)?.id ?? 'storybook-chat';
    const session = sessions.get(chatId) ?? { index: 0 };
    sessions.set(chatId, session);

    const userText = extractLatestUserText(body);
    const response = pickResponse(scenario, session, userText);
    nextIndex(scenario, session);

    responseSeq += 1;
    const messageId = `assistant-${chatId}-${session.index}-${responseSeq}`;
    return createSseResponse({ scenario, response, messageId });
  };

  return includeChainLogo
    ? [chatHandler, createChainLogoFetchHandler()]
    : [chatHandler];
}

export function getScenarioById(id: string) {
  return mockChatScenarios[id] ?? mockChatScenarios.default;
}
